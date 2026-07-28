import { createMarkdownProcessor, type MarkdownProcessor } from '@astrojs/markdown-remark';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { COVERS_BUCKET, db, env } from '@/lib/db';
import type { DoctorId, PostRow, PostStatus } from '@/lib/db-types';
import type { Specialty } from '@/data/specialties';

/**
 * Fonte dos artigos do blog: a tabela `posts` no Postgres.
 *
 * O QUE MUDOU, E POR QUÊ
 * Antes os artigos eram arquivos markdown em src/content/blog, lidos pela
 * Content Layer do Astro. Publicar significava: o painel fazia um COMMIT no
 * GitHub → o push disparava o build → o build regenerava as páginas estáticas.
 * Funcionava, mas cobrava um preço alto:
 *
 *   · dependia de um GITHUB_TOKEN que EXPIRA — no dia em que vencesse, publicar
 *     pararia de funcionar sem aviso e sem erro compreensível para o cliente;
 *   · colocava o GitHub no caminho crítico de "o médico quer publicar";
 *   · o artigo só aparecia 1–2 min depois, e não havia como pré-visualizar;
 *   · EDITAR um artigo publicado simplesmente não existia — só criar e excluir;
 *   · um build inteiro do site rodava para corrigir uma vírgula.
 *
 * Agora publicar é um INSERT e editar é um UPDATE. Some o token, some a espera,
 * some o rebuild.
 *
 * A CONTRAPARTIDA, DECLARADA
 * As páginas do blog deixaram de ser estáticas: elas leem o banco a cada visita
 * (`export const prerender = false`). Isso significa que o blog agora DEPENDE do
 * Postgres estar no ar — antes, só o painel dependia. Duas defesas contra isso:
 *
 *   1. o cache com TTL logo abaixo, que absorve rajadas de visita e reduz o
 *      número de idas ao banco a ~1 por minuto por consulta;
 *   2. o keep-alive em .github/workflows/keep-alive.yml, que impede o projeto
 *      Supabase do plano Free de ser PAUSADO por inatividade — que é, de longe,
 *      a forma mais provável de o banco "cair" neste projeto.
 *
 * O resto do site (home, especialistas, contato) continua 100% estático e não
 * toca o banco em requisição nenhuma.
 */

/* ── Formato exposto às páginas ────────────────────────────────────────────── */

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  /** Corpo em markdown. Use `renderPostBody()` para virar HTML seguro. */
  bodyMd: string;
  specialty: Specialty;
  /** Médico a quem o artigo é atribuído (resolve em src/data/doctors.ts). */
  authorId: DoctorId;
  tags: string[];
  /** URL pública da capa enviada, ou `null` para usar a arte da especialidade. */
  coverUrl: string | null;
  coverAlt: string;
  status: PostStatus;
  /** `null` só em rascunho — o banco proíbe publicado sem data. */
  publishedAt: Date | null;
  updatedAt: Date;
}

const PAGE_SIZE = 9;

/** Colunas lidas nas listagens. `body_md` fica fora: é grande e não é usado no card. */
const LIST_COLUMNS =
  'id, slug, title, description, specialty, author_id, tags, cover_path, cover_alt, status, published_at, updated_at';

const FULL_COLUMNS = `${LIST_COLUMNS}, body_md`;

/**
 * URL pública da capa no Storage.
 *
 * Montada à mão em vez de usar `getPublicUrl()` do supabase-js para não precisar
 * instanciar o cliente (e, com ele, exigir as credenciais) só para formatar uma
 * string. O bucket é público em leitura, então o caminho é estável e previsível.
 */
function coverPublicUrl(path: string | null): string | null {
  if (!path) return null;
  const base = env('SUPABASE_URL');
  if (!base) return null;
  return `${base}/storage/v1/object/public/${COVERS_BUCKET}/${path}`;
}

function toBlogPost(row: Partial<PostRow>): BlogPost {
  return {
    id: row.id!,
    slug: row.slug!,
    title: row.title!,
    description: row.description!,
    bodyMd: row.body_md ?? '',
    specialty: row.specialty as Specialty,
    authorId: row.author_id as DoctorId,
    tags: row.tags ?? [],
    coverUrl: coverPublicUrl(row.cover_path ?? null),
    coverAlt: row.cover_alt ?? '',
    status: row.status as PostStatus,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    updatedAt: new Date(row.updated_at ?? Date.now()),
  };
}

/* ── Cache ─────────────────────────────────────────────────────────────────── */

/**
 * Cache em memória com TTL curto.
 *
 * O adapter Node da Hostinger mantém UM processo vivo entre requisições, então
 * este cache realmente pega: uma rajada de visitas na mesma página vira uma
 * única consulta. Em serverless (Vercel) cada instância tem o seu, o ganho é
 * menor, mas não há prejuízo.
 *
 * 60 s é curto de propósito. `invalidatePostsCache()` é chamado por toda
 * escrita do painel, então quem publica vê o resultado na hora; o TTL é só a
 * rede de segurança para o caso de a escrita ter acontecido em OUTRA instância
 * (cenário de serverless), onde a invalidação direta não alcança.
 */
const CACHE_TTL_MS = 60_000;

const cache = new Map<string, { value: unknown; expiresAt: number }>();

export function invalidatePostsCache(): void {
  cache.clear();
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const value = await load();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/* ── Leitura ───────────────────────────────────────────────────────────────── */

/**
 * Artigos publicados, mais recentes primeiro.
 *
 * O filtro por status vai no BANCO, não em JavaScript: rascunho não deve nem
 * sair do Postgres para uma página pública. Bate no índice parcial
 * `posts_published_idx`.
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  return cached('published', async () => {
    const { data, error } = await db()
      .from('posts')
      .select(LIST_COLUMNS)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) throw new Error(`Não foi possível carregar os artigos: ${error.message}`);
    return (data ?? []).map((row) => toBlogPost(row as Partial<PostRow>));
  });
}

/** Artigos publicados de uma especialidade. Usa `posts_specialty_idx`. */
export async function getPublishedPostsBySpecialty(specialty: Specialty): Promise<BlogPost[]> {
  return cached(`specialty:${specialty}`, async () => {
    const { data, error } = await db()
      .from('posts')
      .select(LIST_COLUMNS)
      .eq('status', 'published')
      .eq('specialty', specialty)
      .order('published_at', { ascending: false });

    if (error) throw new Error(`Não foi possível carregar os artigos: ${error.message}`);
    return (data ?? []).map((row) => toBlogPost(row as Partial<PostRow>));
  });
}

/**
 * Um artigo pelo slug, com o corpo.
 *
 * `includeUnpublished` existe para a PRÉ-VISUALIZAÇÃO de rascunho: a página do
 * artigo passa `true` somente quando há sessão de painel na requisição. Sem
 * sessão, rascunho responde 404 igual a slug inexistente — não fica "escondido
 * por não estar listado", fica inacessível de fato.
 *
 * Não passa pelo cache quando `includeUnpublished`: quem está editando precisa
 * ver a versão que acabou de salvar, não uma de até 60 s atrás.
 */
export async function getPostBySlug(
  slug: string,
  { includeUnpublished = false } = {},
): Promise<BlogPost | null> {
  const load = async () => {
    let query = db().from('posts').select(FULL_COLUMNS).eq('slug', slug);
    if (!includeUnpublished) query = query.eq('status', 'published');

    const { data, error } = await query.maybeSingle();

    if (error) throw new Error(`Não foi possível carregar o artigo: ${error.message}`);
    return data ? toBlogPost(data as Partial<PostRow>) : null;
  };

  return includeUnpublished ? load() : cached(`slug:${slug}`, load);
}

/**
 * Paginação manual (em vez do `paginate()` do Astro) para garantir que
 * /blog SEMPRE exista — mesmo com zero posts — mostrando um estado vazio em
 * vez de retornar 404 enquanto o conteúdo do blog não é publicado.
 */
export function paginatePosts(posts: BlogPost[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: posts.slice(start, start + pageSize),
    currentPage,
    totalPages,
    pageSize,
  };
}

/* ── Markdown → HTML ──────────────────────────────────────────────────────── */

/**
 * Esquema de sanitização: o padrão do rehype-sanitize + o `id` nos títulos.
 *
 * Sem liberar `id`, o `rehypeHeadingIds` do Astro geraria as âncoras e o
 * sanitizador as removeria em seguida — link para seção deixaria de funcionar.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'id'],
  },
};

/**
 * Processador memoizado — montá-lo custa (carrega remark, rehype e plugins) e
 * ele é imutável, então uma instância serve o processo inteiro.
 */
let processor: Promise<MarkdownProcessor> | null = null;

function getProcessor(): Promise<MarkdownProcessor> {
  processor ??= createMarkdownProcessor({ rehypePlugins: [[rehypeSanitize, sanitizeSchema]] });
  return processor;
}

/**
 * Converte o markdown do artigo em HTML **sanitizado**.
 *
 * ⚠️ A SANITIZAÇÃO NÃO É OPCIONAL — não a remova para "permitir um iframe".
 * Este HTML é injetado com `set:html` numa página PÚBLICA. O markdown padrão do
 * Astro deixa HTML cru passar intacto: sem o rehype-sanitize, um `<script>` no
 * corpo do artigo executaria no navegador de todo visitante da clínica. Isso
 * transformaria uma conta de painel comprometida em XSS armazenado no domínio da
 * clínica — redirecionamento, phishing, o que o atacante quisesse.
 *
 * Enquanto o markdown morava em arquivo no git o risco era o mesmo, mas agora
 * há código novo lendo conteúdo do banco, então fica explícito aqui.
 *
 * Usa o processador do próprio Astro (`@astrojs/markdown-remark`) e não um
 * `marked`/`markdown-it` qualquer: assim o artigo renderiza EXATAMENTE como
 * renderizava quando era arquivo — mesmo GFM, mesmas aspas tipográficas, mesmos
 * ids de título. A migração dos posts existentes não muda uma vírgula do HTML.
 */
export async function renderPostBody(markdown: string): Promise<string> {
  const { code } = await (await getProcessor()).render(markdown);
  return code;
}

export { PAGE_SIZE };
