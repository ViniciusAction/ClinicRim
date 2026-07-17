import fs from 'node:fs';
import path from 'node:path';
import { SPECIALTIES, type Specialty } from '@/data/specialties';
import { doctors } from '@/data/doctors';

/**
 * CRUD de posts direto no filesystem (src/content/blog/*.md) — usado SOMENTE
 * pela área restrita (/admin), que roda server-side (prerender = false).
 *
 * Por que fs e não getCollection()? A Content Layer reflete o estado do
 * build/dev server; ler o diretório garante que o painel sempre mostre o que
 * está de fato no disco (inclusive um post recém-criado ou excluído).
 *
 * Fluxo de publicação: em `npm run dev` o novo .md aparece no blog na hora
 * (hot reload). Em produção, as páginas do blog são estáticas — rode
 * `npm run build` após publicar para regenerá-las.
 */
const BLOG_DIR = path.resolve('src/content/blog');
const UPLOADS_DIR = path.resolve('src/assets/blog/uploads');

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

/** Lista os posts existentes no disco (mais recentes primeiro). */
export function listPostsOnDisk(): AdminPostSummary[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => /\.(md|mdx)$/.test(file))
    .map((fileName) => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, fileName), 'utf8');
      return {
        slug: fileName.replace(/\.(md|mdx)$/, ''),
        fileName,
        title: frontmatterValue(raw, 'title') ?? fileName,
        pubDate: frontmatterValue(raw, 'pubDate') ?? '',
        specialty: frontmatterValue(raw, 'specialty') ?? '',
        draft: frontmatterValue(raw, 'draft') === 'true',
      };
    })
    .sort((a, b) => b.pubDate.localeCompare(a.pubDate));
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

/**
 * Cria o arquivo markdown do post (e salva a capa enviada, se houver).
 * Retorna o slug final usado.
 */
export async function createPostOnDisk(input: NewPostInput): Promise<string> {
  fs.mkdirSync(BLOG_DIR, { recursive: true });

  // Slug único: se já existir, sufixa -2, -3…
  const base = slugify(input.title) || 'post';
  let slug = base;
  for (let i = 2; fs.existsSync(path.join(BLOG_DIR, `${slug}.md`)); i++) {
    slug = `${base}-${i}`;
  }

  // Capa: upload do autor ou padrão da especialidade.
  let cover = DEFAULT_COVERS[input.specialty];
  let coverAlt =
    input.coverAlt?.trim() ||
    `Ilustração da especialidade ${input.specialty} — Clínica RIM`;

  if (input.cover && input.cover.size > 0) {
    const ext = ALLOWED_COVER_EXT[input.cover.type];
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const coverFile = `${slug}.${ext}`;
    fs.writeFileSync(
      path.join(UPLOADS_DIR, coverFile),
      Buffer.from(await input.cover.arrayBuffer()),
    );
    cover = `../../assets/blog/uploads/${coverFile}`;
  }

  const today = new Date().toISOString().slice(0, 10);
  // JSON.stringify gera strings YAML válidas (escapa aspas, dois-pontos etc.).
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(input.title.trim())}`,
    `description: ${JSON.stringify(input.description.trim())}`,
    `pubDate: ${today}`,
    `cover: ${JSON.stringify(cover)}`,
    `coverAlt: ${JSON.stringify(coverAlt)}`,
    `tags: [${input.tags.map((t) => JSON.stringify(t)).join(', ')}]`,
    `author: ${JSON.stringify(input.author)}`,
    `specialty: ${JSON.stringify(input.specialty)}`,
    `draft: ${input.draft}`,
    '---',
  ].join('\n');

  fs.writeFileSync(path.join(BLOG_DIR, `${slug}.md`), `${frontmatter}\n\n${input.body.trim()}\n`);
  return slug;
}

/** Exclui um post pelo slug (valida o nome para nunca sair do diretório). */
export function deletePostOnDisk(slug: string): boolean {
  if (!/^[a-z0-9-]+$/.test(slug)) return false;

  for (const ext of ['md', 'mdx']) {
    const file = path.join(BLOG_DIR, `${slug}.${ext}`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
  }
  return false;
}
