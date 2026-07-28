import { randomBytes } from 'node:crypto';
import { SPECIALTIES, type Specialty } from '@/data/specialties';
import { doctors } from '@/data/doctors';
import { COVERS_BUCKET, db } from '@/lib/db';
import { audit } from '@/lib/auth';
import { invalidatePostsCache, type BlogPost } from '@/lib/blog';
import type { DoctorId, PostRow, PostStatus } from '@/lib/db-types';

/**
 * CRUD dos artigos do blog, contra a tabela `posts` no Postgres.
 *
 * O QUE ISTO SUBSTITUIU
 * A versão anterior tinha dois backends — disco (`fs`) no `npm run dev` e
 * COMMIT NO GITHUB em produção — porque o filesystem da função serverless é
 * somente leitura e o markdown precisava chegar ao repositório para o build
 * regenerar as páginas estáticas.
 *
 * Aquele desenho trazia junto:
 *   · um GITHUB_TOKEN que expira, no caminho crítico de publicar;
 *   · comportamento DIFERENTE entre dev e produção — a pior categoria de bug,
 *     porque o teste local não exercita o caminho real;
 *   · espera de 1–2 min por um build inteiro do site;
 *   · nenhuma forma de EDITAR um artigo publicado.
 *
 * Agora há um único caminho, igual em dev e em produção: escrever no banco.
 * Publicar é INSERT, editar é UPDATE, e o artigo está no ar na requisição
 * seguinte. `src/lib/admin/github.ts` foi removido junto com o token.
 *
 * O QUE SE PERDEU, E COMO FOI REPOSTO
 * O commit dava histórico e rollback de graça pelo git. No lugar entrou a
 * tabela `post_revisions`: toda alteração grava o estado ANTERIOR do artigo
 * antes de sobrescrever. É mais útil aqui, porque fica acessível ao médico em
 * vez de exigir `git log`.
 */

/** Capa enviada: caminho no bucket. Sem capa, a página usa a arte da especialidade. */
const ALLOWED_COVER_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_COVER_BYTES = 4 * 1024 * 1024;

/* ── Formatos ──────────────────────────────────────────────────────────────── */

export interface AdminPostSummary {
  id: string;
  slug: string;
  title: string;
  specialty: Specialty;
  authorId: DoctorId;
  status: PostStatus;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface PostInput {
  title: string;
  description: string;
  specialty: Specialty;
  authorId: string;
  tags: string[];
  bodyMd: string;
  /** `draft` não aparece no blog; `published` entra no ar imediatamente. */
  status: PostStatus;
  cover?: File | null;
  coverAlt?: string;
  /** Só na edição: remove a capa enviada e volta para a arte da especialidade. */
  removeCover?: boolean;
}

export interface ActorContext {
  userId: string;
  ip?: string | null;
}

/* ── Leitura do formulário ─────────────────────────────────────────────────── */

/**
 * Traduz o `FormData` do painel em `PostInput`.
 *
 * Fica aqui, e não em cada página, porque /admin/novo e /admin/editar/[slug]
 * postam exatamente os mesmos campos. Duplicar a leitura é como um campo novo
 * acaba salvando na criação e sendo ignorado na edição.
 */
export function parsePostForm(form: FormData): PostInput {
  const cover = form.get('cover');

  return {
    title: String(form.get('title') ?? ''),
    description: String(form.get('description') ?? ''),
    specialty: String(form.get('specialty') ?? '') as Specialty,
    authorId: String(form.get('authorId') ?? ''),
    tags: String(form.get('tags') ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    bodyMd: String(form.get('bodyMd') ?? ''),
    // Qualquer valor que não seja exatamente 'published' cai em rascunho. Um
    // campo ausente ou adulterado erra para o lado seguro: não publica.
    status: form.get('status') === 'published' ? 'published' : 'draft',
    // Navegador manda um File vazio quando nada foi escolhido — daí o `size`.
    cover: cover instanceof File && cover.size > 0 ? cover : null,
    coverAlt: String(form.get('coverAlt') ?? ''),
    removeCover: form.get('removeCover') === 'on',
  };
}

/* ── Slug ──────────────────────────────────────────────────────────────────── */

/**
 * Slug URL-safe a partir do título.
 *
 * O resultado tem de casar com a constraint do banco
 * (`^[a-z0-9]+(-[a-z0-9]+)*$`), por isso o `replace` final: um título terminado
 * em pontuação geraria "titulo-" e o INSERT seria recusado.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/**
 * Slug livre, verificado no banco.
 *
 * `excludeId` existe para a edição: ao renomear o título de um artigo, o slug
 * atual DELE mesmo não deve contar como conflito — senão salvar sem mexer no
 * título viraria "titulo-2" a cada gravação.
 */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const seed = base || 'artigo';

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? seed : `${seed}-${attempt + 1}`;

    let query = db().from('posts').select('id').eq('slug', candidate);
    if (excludeId) query = query.neq('id', excludeId);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Não foi possível verificar o endereço: ${error.message}`);
    if (!data) return candidate;
  }

  // 50 artigos com o mesmo título é implausível; ainda assim, não devolvemos um
  // slug que sabemos estar tomado.
  return `${seed}-${randomBytes(3).toString('hex')}`;
}

/* ── Validação ─────────────────────────────────────────────────────────────── */

/**
 * Valida o formulário. Devolve a lista de problemas (vazia = ok).
 *
 * Os limites repetem de propósito as constraints de 0001_init.sql. O banco é a
 * autoridade final — mas uma violação de CHECK chega como
 * "posts_title_check" na cara do médico. Aqui a mensagem diz o que fazer.
 */
export function validatePostInput(input: PostInput): string[] {
  const errors: string[] = [];

  const title = input.title.trim();
  const description = input.description.trim();
  const body = input.bodyMd.trim();

  if (title.length < 8) errors.push('O título precisa de pelo menos 8 caracteres.');
  if (title.length > 140) errors.push('O título pode ter no máximo 140 caracteres.');

  if (description.length < 20) {
    errors.push('O resumo (usado no SEO e nos cards) precisa de pelo menos 20 caracteres.');
  }
  if (description.length > 300) errors.push('O resumo pode ter no máximo 300 caracteres.');

  if (body.length < 50) errors.push('O conteúdo do artigo precisa de pelo menos 50 caracteres.');

  if (!SPECIALTIES.includes(input.specialty)) errors.push('Especialidade inválida.');
  if (!doctors.some((doctor) => doctor.id === input.authorId)) errors.push('Autor inválido.');
  if (input.status !== 'draft' && input.status !== 'published') errors.push('Situação inválida.');

  // O slug é derivado do título; se ele zerar, o título não tem nenhum caractere
  // aproveitável (só emoji ou pontuação) e o banco recusaria.
  if (!slugify(title)) {
    errors.push('O título precisa conter letras ou números para gerar o endereço do artigo.');
  }

  const hasCover = Boolean(input.cover && input.cover.size > 0);
  if (hasCover) {
    if (!ALLOWED_COVER_EXT[input.cover!.type]) {
      errors.push('A capa deve ser uma imagem JPG, PNG ou WebP.');
    }
    if (input.cover!.size > MAX_COVER_BYTES) errors.push('A capa deve ter no máximo 4 MB.');
    if (!input.coverAlt?.trim()) {
      // O banco tem a mesma regra (posts_cover_needs_alt). Acessibilidade não é
      // opcional: uma capa sem descrição é invisível para leitor de tela.
      errors.push('Descreva a capa no campo de acessibilidade — é obrigatório para capa enviada.');
    }
  }

  return errors;
}

/* ── Capa no Storage ───────────────────────────────────────────────────────── */

/**
 * Sobe a capa e devolve o caminho no bucket.
 *
 * O nome leva um sufixo aleatório em vez de ser só o slug. Sem ele, substituir a
 * capa de um artigo reusaria o mesmo caminho — e a URL, idêntica, continuaria
 * servindo a imagem ANTIGA do cache do navegador e da CDN do Storage. O sufixo
 * torna cada versão uma URL nova.
 */
async function uploadCover(slug: string, file: File): Promise<string> {
  const ext = ALLOWED_COVER_EXT[file.type];
  if (!ext) throw new Error('Formato de capa não suportado.');

  const path = `${slug}-${randomBytes(4).toString('hex')}.${ext}`;

  const { error } = await db()
    .storage.from(COVERS_BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (error) throw new Error(`Não foi possível enviar a capa: ${error.message}`);

  return path;
}

/**
 * Remove a capa do bucket. Nunca lança.
 *
 * Falhar aqui deixa um arquivo órfão de alguns KB — irrelevante. Propagar o erro
 * abortaria a exclusão do artigo ou a troca da capa por causa da limpeza, o que
 * seria muito pior para quem está usando o painel.
 */
async function deleteCover(path: string | null): Promise<void> {
  if (!path) return;

  const { error } = await db().storage.from(COVERS_BUCKET).remove([path]);
  if (error) console.error('[posts] falha ao remover a capa %s: %s', path, error.message);
}

/* ── Leitura ───────────────────────────────────────────────────────────────── */

/** Todos os artigos, de todos os status — a listagem do painel. */
export async function listPosts(): Promise<AdminPostSummary[]> {
  const { data, error } = await db()
    .from('posts')
    .select('id, slug, title, specialty, author_id, status, published_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Não foi possível ler os artigos: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    specialty: row.specialty as Specialty,
    authorId: row.author_id as DoctorId,
    status: row.status as PostStatus,
    publishedAt: row.published_at ? new Date(row.published_at as string) : null,
    updatedAt: new Date(row.updated_at as string),
  }));
}

/** Artigo completo para preencher o formulário de edição. */
export async function getPostForEdit(slug: string): Promise<(BlogPost & { coverPath: string | null }) | null> {
  const { data, error } = await db().from('posts').select('*').eq('slug', slug).maybeSingle();

  if (error) throw new Error(`Não foi possível carregar o artigo: ${error.message}`);
  if (!data) return null;

  const row = data as PostRow;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    bodyMd: row.body_md,
    specialty: row.specialty,
    authorId: row.author_id,
    tags: row.tags ?? [],
    coverPath: row.cover_path,
    // A URL pública não é necessária no formulário; a pré-visualização usa a
    // página do artigo. `coverPath` é o que importa para saber se HÁ capa.
    coverUrl: null,
    coverAlt: row.cover_alt,
    status: row.status,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    updatedAt: new Date(row.updated_at),
  };
}

/* ── Criação ───────────────────────────────────────────────────────────────── */

/** Cria o artigo e devolve o slug final. */
export async function createPost(input: PostInput, actor: ActorContext): Promise<string> {
  const slug = await uniqueSlug(slugify(input.title.trim()));

  const hasCover = Boolean(input.cover && input.cover.size > 0);
  const coverPath = hasCover ? await uploadCover(slug, input.cover!) : null;
  const coverAlt = coverPath ? input.coverAlt!.trim() : '';

  const { error } = await db()
    .from('posts')
    .insert({
      slug,
      title: input.title.trim(),
      description: input.description.trim(),
      body_md: input.bodyMd.trim(),
      specialty: input.specialty,
      author_id: input.authorId,
      tags: input.tags,
      cover_path: coverPath,
      cover_alt: coverAlt,
      status: input.status,
      // O banco recusa publicado sem data (posts_published_needs_date).
      published_at: input.status === 'published' ? new Date().toISOString() : null,
      created_by: actor.userId,
      updated_by: actor.userId,
    });

  if (error) {
    // O artigo não foi criado; deixar a capa no bucket seria lixo permanente.
    await deleteCover(coverPath);
    throw new Error(`Não foi possível salvar o artigo: ${error.message}`);
  }

  invalidatePostsCache();
  await audit({
    action: input.status === 'published' ? 'post.publish' : 'post.create',
    userId: actor.userId,
    target: slug,
    ip: actor.ip,
    metadata: { status: input.status },
  });

  return slug;
}

/* ── Edição ────────────────────────────────────────────────────────────────── */

/**
 * Atualiza um artigo e devolve o slug final (que muda se o título mudar).
 *
 * Antes de sobrescrever, grava o estado ANTERIOR em `post_revisions`. É o que
 * substitui o histórico que o git dava quando os artigos eram arquivos: sem
 * isso, uma edição desastrada seria irreversível.
 */
export async function updatePost(
  currentSlug: string,
  input: PostInput,
  actor: ActorContext,
): Promise<string> {
  const existing = await getPostForEdit(currentSlug);
  if (!existing) throw new Error('Artigo não encontrado.');

  // Snapshot ANTES de qualquer escrita. Se a revisão não puder ser gravada, a
  // edição não acontece — perder a rede de segurança em silêncio é pior que
  // recusar a operação.
  const { error: revisionError } = await db()
    .from('post_revisions')
    .insert({
      post_id: existing.id,
      changed_by: actor.userId,
      snapshot: {
        slug: existing.slug,
        title: existing.title,
        description: existing.description,
        body_md: existing.bodyMd,
        specialty: existing.specialty,
        author_id: existing.authorId,
        tags: existing.tags,
        cover_path: existing.coverPath,
        cover_alt: existing.coverAlt,
        status: existing.status,
        published_at: existing.publishedAt?.toISOString() ?? null,
      },
    });

  if (revisionError) {
    throw new Error(`Não foi possível gravar o histórico da alteração: ${revisionError.message}`);
  }

  // O slug acompanha o título, mas só se o título de fato mudou — assim o
  // endereço de um artigo já divulgado não muda a cada salvamento.
  const slug =
    input.title.trim() === existing.title
      ? existing.slug
      : await uniqueSlug(slugify(input.title.trim()), existing.id);

  /**
   * Resolução da capa, em três casos:
   *  · arquivo novo enviado → sobe o novo, apaga o antigo DEPOIS do UPDATE;
   *  · pediu para remover   → volta para a arte da especialidade;
   *  · nada informado       → mantém a atual (inclusive o texto alternativo).
   */
  const hasNewCover = Boolean(input.cover && input.cover.size > 0);
  let coverPath = existing.coverPath;
  let coverAlt = existing.coverAlt;

  if (hasNewCover) {
    coverPath = await uploadCover(slug, input.cover!);
    coverAlt = input.coverAlt!.trim();
  } else if (input.removeCover) {
    coverPath = null;
    coverAlt = '';
  } else if (coverPath && input.coverAlt !== undefined) {
    // Capa mantida, mas o texto alternativo foi editado. Não deixa virar vazio:
    // o banco tem a constraint posts_cover_needs_alt.
    coverAlt = input.coverAlt.trim() || coverAlt;
  }

  const wasPublished = existing.status === 'published';
  const willPublish = input.status === 'published';

  const { error } = await db()
    .from('posts')
    .update({
      slug,
      title: input.title.trim(),
      description: input.description.trim(),
      body_md: input.bodyMd.trim(),
      specialty: input.specialty,
      author_id: input.authorId,
      tags: input.tags,
      cover_path: coverPath,
      cover_alt: coverAlt,
      status: input.status,
      /**
       * A data de publicação ORIGINAL é preservada na reedição: corrigir uma
       * vírgula não deve jogar o artigo para o topo da listagem nem mentir
       * sobre quando ele saiu. Data nova só na primeira vez que vai ao ar.
       * Despublicar zera — rascunho com data de publicação é estado incoerente.
       */
      published_at: willPublish
        ? (existing.publishedAt?.toISOString() ?? new Date().toISOString())
        : null,
      updated_by: actor.userId,
    })
    .eq('id', existing.id);

  if (error) {
    // O UPDATE falhou: a capa recém-enviada não está referenciada por ninguém.
    if (hasNewCover) await deleteCover(coverPath);
    throw new Error(`Não foi possível salvar as alterações: ${error.message}`);
  }

  // Só depois do UPDATE confirmado — apagar antes deixaria o artigo apontando
  // para um arquivo inexistente se a gravação falhasse.
  if (hasNewCover || input.removeCover) {
    if (existing.coverPath && existing.coverPath !== coverPath) {
      await deleteCover(existing.coverPath);
    }
  }

  invalidatePostsCache();

  const action = !wasPublished && willPublish
    ? 'post.publish'
    : wasPublished && !willPublish
      ? 'post.unpublish'
      : 'post.update';

  await audit({
    action,
    userId: actor.userId,
    target: slug,
    ip: actor.ip,
    metadata: { previousSlug: existing.slug, status: input.status },
  });

  return slug;
}

/* ── Exclusão ──────────────────────────────────────────────────────────────── */

/** Exclui o artigo, o histórico dele (cascade) e a capa enviada. */
export async function deletePost(slug: string, actor: ActorContext): Promise<boolean> {
  const { data, error } = await db()
    .from('posts')
    .delete()
    .eq('slug', slug)
    .select('title, cover_path')
    .maybeSingle();

  if (error) throw new Error(`Não foi possível excluir o artigo: ${error.message}`);
  if (!data) return false;

  const row = data as Pick<PostRow, 'title' | 'cover_path'>;

  await deleteCover(row.cover_path);
  invalidatePostsCache();
  await audit({
    action: 'post.delete',
    userId: actor.userId,
    target: slug,
    ip: actor.ip,
    metadata: { title: row.title },
  });

  return true;
}
