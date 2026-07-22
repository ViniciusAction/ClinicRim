import fs from 'node:fs';
import path from 'node:path';
import { S as SPECIALTIES } from './specialties_BXcCMmga.mjs';
import { d as doctors } from './doctors_Big4xRq3.mjs';

const BLOG_DIR = path.resolve("src/content/blog");
const UPLOADS_DIR = path.resolve("src/assets/blog/uploads");
const DEFAULT_COVERS = {
  Nefrologia: "../../assets/blog/capa-nefrologia.svg",
  Endocrinologia: "../../assets/blog/capa-endocrinologia.svg",
  Urologia: "../../assets/blog/capa-urologia.svg"
};
const ALLOWED_COVER_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
function slugify(input) {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function frontmatterValue(raw, key) {
  const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, "");
}
function listPostsOnDisk() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR).filter((file) => /\.(md|mdx)$/.test(file)).map((fileName) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, fileName), "utf8");
    return {
      slug: fileName.replace(/\.(md|mdx)$/, ""),
      fileName,
      title: frontmatterValue(raw, "title") ?? fileName,
      pubDate: frontmatterValue(raw, "pubDate") ?? "",
      specialty: frontmatterValue(raw, "specialty") ?? "",
      draft: frontmatterValue(raw, "draft") === "true"
    };
  }).sort((a, b) => b.pubDate.localeCompare(a.pubDate));
}
function validateNewPost(input) {
  const errors = [];
  if (input.title.trim().length < 8) errors.push("O título precisa de pelo menos 8 caracteres.");
  if (input.description.trim().length < 20)
    errors.push("A descrição (resumo para SEO/cards) precisa de pelo menos 20 caracteres.");
  if (!SPECIALTIES.includes(input.specialty)) errors.push("Especialidade inválida.");
  if (!doctors.some((d) => d.id === input.author)) errors.push("Autor inválido.");
  if (input.body.trim().length < 50)
    errors.push("O conteúdo do artigo precisa de pelo menos 50 caracteres.");
  if (input.cover && input.cover.size > 0 && !ALLOWED_COVER_EXT[input.cover.type])
    errors.push("A capa deve ser uma imagem JPG, PNG ou WebP.");
  if (input.cover && input.cover.size > 4 * 1024 * 1024)
    errors.push("A capa deve ter no máximo 4 MB.");
  return errors;
}
async function createPostOnDisk(input) {
  fs.mkdirSync(BLOG_DIR, { recursive: true });
  const base = slugify(input.title) || "post";
  let slug = base;
  for (let i = 2; fs.existsSync(path.join(BLOG_DIR, `${slug}.md`)); i++) {
    slug = `${base}-${i}`;
  }
  let cover = DEFAULT_COVERS[input.specialty];
  let coverAlt = input.coverAlt?.trim() || `Ilustração da especialidade ${input.specialty} — Clínica RIM`;
  if (input.cover && input.cover.size > 0) {
    const ext = ALLOWED_COVER_EXT[input.cover.type];
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const coverFile = `${slug}.${ext}`;
    fs.writeFileSync(
      path.join(UPLOADS_DIR, coverFile),
      Buffer.from(await input.cover.arrayBuffer())
    );
    cover = `../../assets/blog/uploads/${coverFile}`;
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(input.title.trim())}`,
    `description: ${JSON.stringify(input.description.trim())}`,
    `pubDate: ${today}`,
    `cover: ${JSON.stringify(cover)}`,
    `coverAlt: ${JSON.stringify(coverAlt)}`,
    `tags: [${input.tags.map((t) => JSON.stringify(t)).join(", ")}]`,
    `author: ${JSON.stringify(input.author)}`,
    `specialty: ${JSON.stringify(input.specialty)}`,
    `draft: ${input.draft}`,
    "---"
  ].join("\n");
  fs.writeFileSync(path.join(BLOG_DIR, `${slug}.md`), `${frontmatter}

${input.body.trim()}
`);
  return slug;
}
function deletePostOnDisk(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  for (const ext of ["md", "mdx"]) {
    const file = path.join(BLOG_DIR, `${slug}.${ext}`);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
  }
  return false;
}

export { createPostOnDisk as c, deletePostOnDisk as d, listPostsOnDisk as l, validateNewPost as v };
