import { b as createAstro, c as createComponent, r as renderComponent, a as renderTemplate, m as maybeRenderHead, d as addAttribute } from '../chunks/astro/server_BUPcWb2m.mjs';
import 'piccolore';
import { $ as $$AdminLayout } from '../chunks/AdminLayout_K6mZeHzV.mjs';
import { d as deletePostOnDisk, l as listPostsOnDisk } from '../chunks/posts_WD29qgCC.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro("https://www.clinicarim.com.br");
const prerender = false;
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  let notice = null;
  if (Astro2.request.method === "POST") {
    const form = await Astro2.request.formData();
    if (form.get("action") === "delete") {
      const slug = String(form.get("slug") ?? "");
      notice = deletePostOnDisk(slug) ? { kind: "success", text: `Artigo "${slug}" exclu\xEDdo.` } : { kind: "error", text: "N\xE3o foi poss\xEDvel excluir este artigo." };
    }
  }
  const created = Astro2.url.searchParams.get("ok");
  if (created) {
    notice = { kind: "success", text: `Artigo publicado! Veja em /blog/${created}/` };
  }
  const posts = listPostsOnDisk();
  return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, { "title": "Publica\xE7\xF5es" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="flex flex-wrap items-end justify-between gap-4"> <div> <h1 class="font-display text-2xl font-medium text-ink-900">Publicações</h1> <p class="mt-1 font-sans text-sm text-ink-500"> ${posts.length} artigo${posts.length === 1 ? "" : "s"} no blog da clínica.
</p> </div> <a href="/admin/novo" class="inline-flex h-11 items-center gap-2 rounded-md bg-azure-600 px-6 font-sans text-sm font-medium text-white transition-all hover:bg-azure-500"> <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"> <path d="M12 5v14M5 12h14"></path> </svg>
Novo artigo
</a> </div> ${notice && renderTemplate`<p role="status"${addAttribute([
    "mt-6 rounded-2xl border px-4 py-3 font-sans text-sm",
    notice.kind === "success" ? "border-azure-200 bg-azure-50 text-azure-800" : "border-red-200 bg-red-50 text-red-700"
  ], "class:list")}> ${notice.text} </p>`}<div class="mt-8 overflow-hidden rounded-2xl border border-ink-100 bg-white"> ${posts.length === 0 ? renderTemplate`<p class="p-10 text-center font-sans text-sm text-ink-500">
Nenhum artigo ainda. Clique em <strong>Novo artigo</strong> para publicar o primeiro.
</p>` : renderTemplate`<ul class="divide-y divide-ink-100"> ${posts.map((post) => renderTemplate`<li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4"> <div class="min-w-0 flex-1"> <p class="truncate font-sans text-sm font-medium text-ink-900"> ${post.title} ${post.draft && renderTemplate`<span class="ml-2 rounded-md bg-gold-100 px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-gold-700 uppercase">
rascunho
</span>`} </p> <p class="mt-0.5 font-sans text-xs text-ink-400"> ${post.specialty} · ${post.pubDate} · <code class="text-ink-500">${post.fileName}</code> </p> </div> <a${addAttribute(`/blog/${post.slug}/`, "href")} target="_blank" rel="noopener" class="rounded-md border border-ink-200 px-3.5 py-1.5 font-sans text-xs font-medium text-ink-700 transition-colors hover:border-azure-300 hover:bg-azure-50">
Ver ↗
</a> <form method="post"${addAttribute(`return confirm('Excluir o artigo \u201C${post.title.replaceAll("'", "\u2019").replaceAll('"', "\u201D")}\u201D? Esta a\xE7\xE3o n\xE3o pode ser desfeita.');`, "onsubmit")}> <input type="hidden" name="action" value="delete"> <input type="hidden" name="slug"${addAttribute(post.slug, "value")}> <button type="submit" class="rounded-md border border-red-200 px-3.5 py-1.5 font-sans text-xs font-medium text-red-600 transition-colors hover:bg-red-50">
Excluir
</button> </form> </li>`)} </ul>`} </div> <p class="mt-6 font-sans text-xs leading-relaxed text-ink-400">
ℹ️ Em desenvolvimento (<code>npm run dev</code>) o artigo aparece no blog imediatamente. Em
    produção, o blog é estático — rode <code>npm run build</code> após publicar para regenerar as
    páginas.
</p> ` })}`;
}, "D:/Cursos/medico_blog_astro-teste/src/pages/admin/index.astro", void 0);

const $$file = "D:/Cursos/medico_blog_astro-teste/src/pages/admin/index.astro";
const $$url = "/admin";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
