import fs from 'node:fs';
import path from 'node:path';
import { SPECIALTIES, type Specialty } from '@/data/specialties';
import { doctors } from '@/data/doctors';
import { commitFiles, getGitHubConfig, listMarkdown, type FileChange } from '@/lib/admin/github';

/**
 * CRUD dos posts do blog, com DOIS backends:
 *
 *  - `fs`     — grava direto em src/content/blog. Usado no `npm run dev`:
 *               o post aparece no blog na hora (hot reload), sem token e sem
 *               poluir o histórico do git com commits de teste.
 *  - `github` — faz commit no repositório via API. Obrigatório em produção,
 *               porque o filesystem da função serverless na Vercel é somente
 *               leitura. O push dispara o build e as páginas do blog são
 *               regeneradas (~1-2 min).
 *
 * A escolha é automática: se GITHUB_TOKEN e GITHUB_REPO estiverem definidos,
 * usa GitHub; senão, disco. Em produção sem essas variáveis, `publishBackend`
 * devolve 'unavailable' e o painel avisa em vez de estourar EROFS na cara do
 * usuário.
 */
const BLOG_DIR = 'src/content/blog';
const UPLOADS_DIR = 'src/assets/blog/uploads';

/** Capa padrão por especialidade (usada quando o autor não envia imagem). */
const DEFAULT_COVERS: Record<Specialty, string> = {
  Nefrologia: '../../assets/blog/capa-nefrologia.svg',
  Endocrinologia: '../../assets/blog/capa-endocrinologia.svg',
  Urologia: '../../assets/blog/capa-urologia.svg',
};

const ALLOWED_COVER_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type PublishBackend = 'fs' | 'github' | 'unavailable';

export interface AdminPostSummary {
  slug: string;
  fileName: string;
  title: string;
  pubDate: string;
  specialty: string;
  draft: boolean;
}

export interface NewPostInput {
  title: string;
  description: string;
  specialty: Specialty;
  author: string;
  tags: string[];
  body: string;
  draft: boolean;
  cover?: File | null;
  coverAlt?: string;
}

/** Qual backend está ativo nesta execução. */
export function publishBackend(): PublishBackend {
  if (getGitHubConfig()) return 'github';
  // Em produção o filesystem é somente leitura — disco não é opção.
  return import.meta.env.PROD ? 'unavailable' : 'fs';
}

/** Slug URL-safe a partir do título (remove acentos, minúsculas, hífens). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function frontmatterValue(raw: string, key: string): string | undefined {
  const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '');
}

function toSummary(fileName: string, raw: string): AdminPostSummary {
  return {
    slug: fileName.replace(/\.(md|mdx)$/, ''),
    fileName,
    title: frontmatterValue(raw, 'title') ?? fileName,
    pubDate: frontmatterValue(raw, 'pubDate') ?? '',
    specialty: frontmatterValue(raw, 'specialty') ?? '',
    draft: frontmatterValue(raw, 'draft') === 'true',
  };
}

const byDateDesc = (a: AdminPostSummary, b: AdminPostSummary) => b.pubDate.localeCompare(a.pubDate);

/** Monta o markdown completo (frontmatter + corpo). */
function buildMarkdown(
  input: NewPostInput,
  cover: string,
  coverAlt: string,
  pubDate: string,
): string {
  // JSON.stringify gera strings YAML válidas (escapa aspas, dois-pontos etc.).
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(input.title.trim())}`,
    `description: ${JSON.stringify(input.description.trim())}`,
    `pubDate: ${pubDate}`,
    `cover: ${JSON.stringify(cover)}`,
    `coverAlt: ${JSON.stringify(coverAlt)}`,
    `tags: [${input.tags.map((t) => JSON.stringify(t)).join(', ')}]`,
    `author: ${JSON.stringify(input.author)}`,
    `specialty: ${JSON.stringify(input.specialty)}`,
    `draft: ${input.draft}`,
    '---',
  ].join('\n');

  return `${frontmatter}\n\n${input.body.trim()}\n`;
}

/** Valida os campos do formulário; retorna a lista de erros (vazia = ok). */
export function validateNewPost(input: NewPostInput): string[] {
  const errors: string[] = [];
  if (input.title.trim().length < 8) errors.push('O título precisa de pelo menos 8 caracteres.');
  if (input.description.trim().length < 20)
    errors.push('A descrição (resumo para SEO/cards) precisa de pelo menos 20 caracteres.');
  if (!SPECIALTIES.includes(input.specialty)) errors.push('Especialidade inválida.');
  if (!doctors.some((d) => d.id === input.author)) errors.push('Autor inválido.');
  if (input.body.trim().length < 50)
    errors.push('O conteúdo do artigo precisa de pelo menos 50 caracteres.');
  if (input.cover && input.cover.size > 0 && !ALLOWED_COVER_EXT[input.cover.type])
    errors.push('A capa deve ser uma imagem JPG, PNG ou WebP.');
  if (input.cover && input.cover.size > 4 * 1024 * 1024)
    errors.push('A capa deve ter no máximo 4 MB.');
  return errors;
}

/* ── Leitura ───────────────────────────────────────────────────────────── */

/** Lista os posts (mais recentes primeiro), do backend ativo. */
export async function listPosts(): Promise<AdminPostSummary[]> {
  const cfg = getGitHubConfig();

  if (cfg) {
    const files = await listMarkdown(cfg, BLOG_DIR);
    return files.map((f) => toSummary(f.name, f.raw)).sort(byDateDesc);
  }

  const dir = path.resolve(BLOG_DIR);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((file) => /\.(md|mdx)$/.test(file))
    .map((fileName) => toSummary(fileName, fs.readFileSync(path.join(dir, fileName), 'utf8')))
    .sort(byDateDesc);
}

/* ── Criação ───────────────────────────────────────────────────────────── */

/**
 * Publica o post no backend ativo (e salva a capa enviada, se houver).
 * Retorna o slug final usado.
 */
export async function createPost(input: NewPostInput): Promise<string> {
  const cfg = getGitHubConfig();
  const base = slugify(input.title) || 'post';
  const pubDate = new Date().toISOString().slice(0, 10);

  const hasCover = Boolean(input.cover && input.cover.size > 0);
  const coverExt = hasCover ? ALLOWED_COVER_EXT[input.cover!.type] : null;
  const coverBytes = hasCover ? new Uint8Array(await input.cover!.arrayBuffer()) : null;

  const coverAlt =
    input.coverAlt?.trim() || `Ilustração da especialidade ${input.specialty} — Clínica RIM`;

  if (cfg) {
    // Slug único: consulta os nomes já existentes no repositório.
    const taken = new Set((await listMarkdown(cfg, BLOG_DIR)).map((f) => f.name));
    let slug = base;
    for (let i = 2; taken.has(`${slug}.md`) || taken.has(`${slug}.mdx`); i++) slug = `${base}-${i}`;

    const changes: FileChange[] = [];
    let cover = DEFAULT_COVERS[input.specialty];

    if (coverBytes && coverExt) {
      const coverFile = `${slug}.${coverExt}`;
      changes.push({ path: `${UPLOADS_DIR}/${coverFile}`, content: coverBytes });
      cover = `../../assets/blog/uploads/${coverFile}`;
    }

    changes.push({
      path: `${BLOG_DIR}/${slug}.md`,
      content: buildMarkdown(input, cover, coverAlt, pubDate),
    });

    await commitFiles(
      cfg,
      `content: publica "${input.title.trim()}"${input.draft ? ' (rascunho)' : ''}\n\nPublicado pelo painel /admin da Clínica Rim.`,
      changes,
    );

    return slug;
  }

  if (import.meta.env.PROD) {
    throw new Error(
      'Publicação indisponível: defina GITHUB_TOKEN e GITHUB_REPO. ' +
        'Em produção o filesystem é somente leitura, então o post precisa ir por commit.',
    );
  }

  // Backend de disco (desenvolvimento).
  const dir = path.resolve(BLOG_DIR);
  fs.mkdirSync(dir, { recursive: true });

  let slug = base;
  for (let i = 2; fs.existsSync(path.join(dir, `${slug}.md`)); i++) slug = `${base}-${i}`;

  let cover = DEFAULT_COVERS[input.specialty];
  if (coverBytes && coverExt) {
    const uploads = path.resolve(UPLOADS_DIR);
    fs.mkdirSync(uploads, { recursive: true });
    const coverFile = `${slug}.${coverExt}`;
    fs.writeFileSync(path.join(uploads, coverFile), coverBytes);
    cover = `../../assets/blog/uploads/${coverFile}`;
  }

  fs.writeFileSync(path.join(dir, `${slug}.md`), buildMarkdown(input, cover, coverAlt, pubDate));
  return slug;
}

/* ── Exclusão ──────────────────────────────────────────────────────────── */

/**
 * Exclui um post pelo slug — e a capa dele, se for um upload.
 * Valida o nome para nunca sair do diretório.
 */
export async function deletePost(slug: string): Promise<boolean> {
  if (!/^[a-z0-9-]+$/.test(slug)) return false;

  const cfg = getGitHubConfig();

  if (cfg) {
    const files = await listMarkdown(cfg, BLOG_DIR);
    const target = files.find((f) => f.name === `${slug}.md` || f.name === `${slug}.mdx`);
    if (!target) return false;

    const changes: FileChange[] = [{ path: target.path, content: null }];

    // Se a capa era um upload deste post, remove no mesmo commit.
    const cover = frontmatterValue(target.raw, 'cover');
    if (cover?.includes('/assets/blog/uploads/')) {
      const coverFile = cover.split('/').pop();
      if (coverFile) changes.push({ path: `${UPLOADS_DIR}/${coverFile}`, content: null });
    }

    const title = frontmatterValue(target.raw, 'title') ?? slug;
    await commitFiles(
      cfg,
      `content: remove "${title}"\n\nExcluído pelo painel /admin da Clínica Rim.`,
      changes,
    );
    return true;
  }

  if (import.meta.env.PROD) return false;

  for (const ext of ['md', 'mdx']) {
    const file = path.resolve(BLOG_DIR, `${slug}.${ext}`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
  }
  return false;
}
