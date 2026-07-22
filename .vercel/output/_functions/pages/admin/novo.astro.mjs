import { b as createAstro, c as createComponent, r as renderComponent, a as renderTemplate, m as maybeRenderHead, d as addAttribute } from '../../chunks/astro/server_BUPcWb2m.mjs';
import 'piccolore';
import { $ as $$AdminLayout } from '../../chunks/AdminLayout_K6mZeHzV.mjs';
import { S as SPECIALTIES } from '../../chunks/specialties_BXcCMmga.mjs';
import { d as doctors } from '../../chunks/doctors_Big4xRq3.mjs';
import { v as validateNewPost, c as createPostOnDisk } from '../../chunks/posts_WD29qgCC.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro("https://www.clinicarim.com.br");
const prerender = false;
const $$Novo = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Novo;
  let errors = [];
  const values = {
    title: "",
    description: "",
    specialty: "Nefrologia",
    author: doctors[0]?.id ?? "",
    tags: "",
    coverAlt: "",
    body: "",
    draft: false
  };
  if (Astro2.request.method === "POST") {
    const form = await Astro2.request.formData();
    values.title = String(form.get("title") ?? "");
    values.description = String(form.get("description") ?? "");
    values.specialty = String(form.get("specialty") ?? "");
    values.author = String(form.get("author") ?? "");
    values.tags = String(form.get("tags") ?? "");
    values.coverAlt = String(form.get("coverAlt") ?? "");
    values.body = String(form.get("body") ?? "");
    values.draft = form.get("draft") === "on";
    const coverEntry = form.get("cover");
    const input = {
      title: values.title,
      description: values.description,
      specialty: values.specialty,
      author: values.author,
      tags: values.tags.split(",").map((t) => t.trim()).filter(Boolean),
      body: values.body,
      draft: values.draft,
      cover: coverEntry instanceof File ? coverEntry : null,
      coverAlt: values.coverAlt
    };
    errors = validateNewPost(input);
    if (errors.length === 0) {
      const slug = await createPostOnDisk(input);
      return Astro2.redirect(`/admin?ok=${encodeURIComponent(slug)}`);
    }
  }
  const inputClass = "block w-full rounded-md border border-ink-200 bg-white px-4 py-2.5 font-sans text-sm text-ink-900 focus:border-azure-400 focus:ring-2 focus:ring-azure-400 focus:outline-none";
  const labelClass = "mb-1.5 block font-sans text-sm font-medium text-ink-900";
  return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, { "title": "Novo artigo" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="mx-auto max-w-3xl"> <h1 class="font-display text-2xl font-medium text-ink-900">Novo artigo</h1> <p class="mt-1 font-sans text-sm text-ink-500">
Escreva em Markdown (títulos com <code>##</code>, negrito com <code>**texto**</code>, listas
      com <code>-</code>). A capa é opcional — sem envio, usamos a arte padrão da especialidade.
</p> ${errors.length > 0 && renderTemplate`<div role="alert" class="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-sans text-sm text-red-700"> <p class="font-medium">Corrija os pontos abaixo:</p> <ul class="mt-2 list-disc space-y-1 pl-5"> ${errors.map((e) => renderTemplate`<li>${e}</li>`)} </ul> </div>`} <form method="post" enctype="multipart/form-data" class="mt-8 space-y-6 rounded-2xl border border-ink-100 bg-white p-8 sm:p-9"> <div> <label for="title"${addAttribute(labelClass, "class")}>Título *</label> <input id="title" name="title" type="text" required${addAttribute(values.title, "value")}${addAttribute(inputClass, "class")}> </div> <div> <label for="description"${addAttribute(labelClass, "class")}>Resumo (SEO e cards do blog) *</label> <textarea id="description" name="description" rows="2" required${addAttribute(inputClass, "class")}>${values.description}</textarea> </div> <div class="grid gap-6 sm:grid-cols-2"> <div> <label for="specialty"${addAttribute(labelClass, "class")}>Especialidade *</label> <select id="specialty" name="specialty"${addAttribute(inputClass, "class")}> ${SPECIALTIES.map((s) => renderTemplate`<option${addAttribute(s, "value")}${addAttribute(s === values.specialty, "selected")}> ${s} </option>`)} </select> </div> <div> <label for="author"${addAttribute(labelClass, "class")}>Autor *</label> <select id="author" name="author"${addAttribute(inputClass, "class")}> ${doctors.map((d) => renderTemplate`<option${addAttribute(d.id, "value")}${addAttribute(d.id === values.author, "selected")}> ${d.name} — ${d.role} </option>`)} </select> </div> </div> <div> <label for="tags"${addAttribute(labelClass, "class")}>Tags (separadas por vírgula)</label> <input id="tags" name="tags" type="text" placeholder="ex.: prevenção, rins, hipertensão"${addAttribute(values.tags, "value")}${addAttribute(inputClass, "class")}> </div> <div class="grid gap-6 sm:grid-cols-2"> <div> <label for="cover"${addAttribute(labelClass, "class")}>Capa (JPG, PNG ou WebP — opcional)</label> <input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" class="block w-full font-sans text-sm text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-azure-50 file:px-4 file:py-2 file:font-sans file:text-sm file:font-medium file:text-azure-700 hover:file:bg-azure-100"> </div> <div> <label for="coverAlt"${addAttribute(labelClass, "class")}>Descrição da capa (acessibilidade)</label> <input id="coverAlt" name="coverAlt" type="text" placeholder="ex.: Médica examinando exame de ultrassom"${addAttribute(values.coverAlt, "value")}${addAttribute(inputClass, "class")}> </div> </div> <div> <label for="body"${addAttribute(labelClass, "class")}>Conteúdo do artigo (Markdown) *</label> <textarea id="body" name="body" rows="16" required${addAttribute("## Primeiro subt\xEDtulo\n\nTexto do artigo...", "placeholder")}${addAttribute(`${inputClass} font-mono leading-relaxed`, "class")}>${values.body}</textarea> </div> <label class="flex items-center gap-3 font-sans text-sm text-ink-700"> <input type="checkbox" name="draft"${addAttribute(values.draft, "checked")} class="size-4 rounded border-ink-300 text-azure-600 focus:ring-azure-400">
Salvar como rascunho (não aparece no blog)
</label> <div class="flex items-center gap-4 border-t border-ink-100 pt-6"> <button type="submit" class="inline-flex h-12 items-center justify-center rounded-md bg-azure-600 px-8 font-sans text-sm font-medium text-white transition-all hover:bg-azure-500 focus-visible:ring-2 focus-visible:ring-azure-500 focus-visible:ring-offset-2 focus-visible:outline-none">
Publicar artigo
</button> <a href="/admin" class="font-sans text-sm font-medium text-ink-500 hover:text-ink-800">
Cancelar
</a> </div> </form> </div> ` })}`;
}, "D:/Cursos/medico_blog_astro-teste/src/pages/admin/novo.astro", void 0);

const $$file = "D:/Cursos/medico_blog_astro-teste/src/pages/admin/novo.astro";
const $$url = "/admin/novo";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Novo,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
