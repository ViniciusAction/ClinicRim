/**
 * Migra os artigos de src/content/blog/*.md para a tabela `posts` no Postgres.
 *
 *   npm run migrate:posts            # mostra o que faria, sem gravar
 *   npm run migrate:posts -- --apply # grava
 *
 * Roda UMA vez, na virada do blog de arquivos markdown para banco. Depois disso
 * os artigos nascem direto no banco pelo painel e este script não tem mais uso —
 * fica no repositório como registro de como a migração foi feita.
 *
 * É idempotente: slug que já existe no banco é pulado. Rodar de novo não
 * duplica nada e não sobrescreve edição feita pelo painel.
 *
 * O padrão é DRY-RUN de propósito. Um script que escreve no banco de produção ao
 * ser executado sem argumento é um acidente esperando acontecer — sobretudo um
 * que se roda uma única vez e cujo comportamento ninguém lembra depois.
 *
 * Roda no Node puro (sem Vite), por isso os imports são relativos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { doctors } from '../src/data/doctors.ts';
import { SPECIALTIES } from '../src/data/specialties.ts';
import { COVERS_BUCKET, db, dbConfigError } from '../src/lib/db.ts';

const BLOG_DIR = 'src/content/blog';
const APPLY = process.argv.includes('--apply');

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

interface Frontmatter {
  title?: string;
  description?: string;
  pubDate?: string | Date;
  cover?: string;
  coverAlt?: string;
  tags?: string[];
  author?: string;
  specialty?: string;
  draft?: boolean;
}

/**
 * Sobe uma capa que era arquivo do repositório para o bucket do Storage.
 *
 * As capas PADRÃO de especialidade (`capa-nefrologia.svg` e companhia) NÃO
 * passam por aqui: elas continuam sendo imports estáticos do componente
 * PostCover, otimizadas no build. Só capa que estava em assets/blog/uploads/
 * — enviada por alguém pelo painel antigo — precisa mudar de lugar.
 */
async function migrateCover(coverField: string | undefined): Promise<string | null> {
  if (!coverField || !coverField.includes('/uploads/')) return null;

  const fileName = coverField.split('/').pop()!;
  const source = path.resolve('src/assets/blog/uploads', fileName);

  if (!fs.existsSync(source)) {
    console.warn(`  ⚠ capa referenciada não existe no disco: ${fileName} — usando a arte padrão.`);
    return null;
  }

  const ext = path.extname(fileName).slice(1).toLowerCase();
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  if (!APPLY) {
    console.log(`  · [dry-run] subiria a capa ${fileName} para ${COVERS_BUCKET}/`);
    return fileName;
  }

  const { error } = await db()
    .storage.from(COVERS_BUCKET)
    .upload(fileName, fs.readFileSync(source), { contentType, upsert: true });

  if (error) fail(`Falha ao subir a capa ${fileName}: ${error.message}`);

  console.log(`  · capa enviada: ${fileName}`);
  return fileName;
}

async function main() {
  const configError = dbConfigError();
  if (configError) fail(`${configError}\n  Rode com um .env preenchido na raiz do projeto.`);

  const dir = path.resolve(BLOG_DIR);
  if (!fs.existsSync(dir)) fail(`Diretório não encontrado: ${BLOG_DIR}`);

  const files = fs.readdirSync(dir).filter((file) => /\.(md|mdx)$/.test(file));
  if (files.length === 0) {
    console.log('\nNada a migrar: nenhum arquivo markdown em src/content/blog.\n');
    return;
  }

  /**
   * `created_by` é NOT NULL e referencia admin_users. O autor do artigo é um
   * doctor_id, então precisamos da CONTA correspondente. Se o médico não tiver
   * conta, cai na primeira conta ativa — o artigo é do médico de qualquer forma
   * (author_id preserva isso); created_by só registra quem operou.
   */
  const { data: accounts, error: accountsError } = await db()
    .from('admin_users')
    .select('id, doctor_id, email')
    .eq('active', true)
    .order('created_at');

  if (accountsError) fail(`Não foi possível ler admin_users: ${accountsError.message}`);
  if (!accounts || accounts.length === 0) {
    fail('Nenhuma conta ativa no painel. Rode `npm run seed:admins` antes de migrar.');
  }

  const byDoctor = new Map(
    (accounts as Array<{ id: string; doctor_id: string | null }>)
      .filter((account) => account.doctor_id)
      .map((account) => [account.doctor_id!, account.id]),
  );
  const fallbackAccount = (accounts as Array<{ id: string }>)[0]!.id;

  const { data: existingRows, error: existingError } = await db().from('posts').select('slug');
  if (existingError) fail(`Não foi possível ler posts: ${existingError.message}`);

  const taken = new Set((existingRows ?? []).map((row) => row.slug as string));

  console.log(
    `\n${APPLY ? 'MIGRANDO' : 'DRY-RUN (nada será gravado — use --apply para valer)'}\n` +
      `${'─'.repeat(72)}`,
  );

  let migrated = 0;
  let skipped = 0;

  for (const fileName of files) {
    const slug = fileName.replace(/\.(md|mdx)$/, '');
    const raw = fs.readFileSync(path.join(dir, fileName), 'utf8');
    const { frontmatter, content } = parseFrontmatter(raw);
    const meta = frontmatter as Frontmatter;

    console.log(`\n▸ ${slug}`);

    if (taken.has(slug)) {
      console.log('  · já existe no banco — pulando.');
      skipped++;
      continue;
    }

    // Validações que o banco faria de qualquer forma; aqui a mensagem diz qual
    // arquivo está errado, em vez de só o nome da constraint.
    if (!meta.title || !meta.description || !content.trim()) {
      fail(`${fileName}: falta title, description ou corpo.`);
    }
    if (!SPECIALTIES.includes(meta.specialty as (typeof SPECIALTIES)[number])) {
      fail(`${fileName}: especialidade inválida (${meta.specialty}).`);
    }
    if (!doctors.some((doctor) => doctor.id === meta.author)) {
      fail(`${fileName}: autor inválido (${meta.author}).`);
    }

    const isDraft = meta.draft === true;
    const coverPath = await migrateCover(meta.cover);

    /**
     * `pubDate` do frontmatter é a data real de publicação e precisa ser
     * preservada: é ela que ordena a listagem e vai no RSS. Perder isso
     * empilharia os artigos antigos com a data da migração.
     */
    const publishedAt = isDraft ? null : new Date(meta.pubDate ?? Date.now()).toISOString();

    const row = {
      slug,
      title: meta.title.trim(),
      description: meta.description.trim(),
      body_md: content.trim(),
      specialty: meta.specialty,
      author_id: meta.author,
      tags: meta.tags ?? [],
      cover_path: coverPath,
      // O banco exige texto alternativo quando há capa (posts_cover_needs_alt).
      cover_alt: coverPath ? (meta.coverAlt?.trim() || `Capa do artigo ${meta.title}`) : '',
      status: isDraft ? 'draft' : 'published',
      published_at: publishedAt,
      created_by: byDoctor.get(meta.author!) ?? fallbackAccount,
      updated_by: byDoctor.get(meta.author!) ?? fallbackAccount,
    };

    console.log(
      `  · ${row.status}${publishedAt ? ` em ${publishedAt.slice(0, 10)}` : ''}` +
        ` · ${row.specialty} · ${row.author_id} · ${row.body_md.length} chars` +
        ` · capa: ${coverPath ?? 'arte padrão'}`,
    );

    if (!APPLY) {
      migrated++;
      continue;
    }

    const { error } = await db().from('posts').insert(row);
    if (error) fail(`Falha ao inserir ${slug}: ${error.message}`);

    console.log('  ✔ gravado.');
    migrated++;
  }

  console.log(`\n${'─'.repeat(72)}`);
  console.log(
    `${APPLY ? 'Migrados' : 'Seriam migrados'}: ${migrated} · Pulados (já existiam): ${skipped}`,
  );

  if (!APPLY) {
    console.log('\nNada foi gravado. Rode de novo com --apply para aplicar.');
  } else {
    console.log('\nConfira em /admin e em /blog. Os arquivos .md podem ser removidos depois:');
    console.log('  git rm -r src/content/blog src/assets/blog/uploads');
    console.log('(o git guarda o histórico, então nada é perdido de verdade)');
  }
  console.log('');
}

main().catch((error: unknown) => fail((error as Error).message));
