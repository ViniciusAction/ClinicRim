import { b as createAstro, c as createComponent, e as renderHead, a as renderTemplate, f as renderSlot } from './astro/server_BUPcWb2m.mjs';
import 'piccolore';
import 'clsx';
/* empty css                         */

const $$Astro = createAstro("https://www.clinicarim.com.br");
const $$AdminLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$AdminLayout;
  const { title, bare = false } = Astro2.props;
  return renderTemplate`<html lang="pt-BR"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"><title>${title} — Área da equipe · Clínica RIM</title>${renderHead()}</head> <body class="min-h-screen bg-ivory font-sans text-ink-700 antialiased"> ${!bare && renderTemplate`<header class="border-b border-ink-100 bg-white"> <div class="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6"> <a href="/admin" class="flex items-center gap-2.5" aria-label="Painel — início"> <span class="flex size-8 items-center justify-center rounded-md bg-azure-600 text-white"> <svg class="size-4" viewBox="0 0 96 96" fill="none" aria-hidden="true"> <path d="M60 10c-19 0-34 16-34 37 0 16 9 27 21 31 6 2 12 2 17-1-6-4-9-10-9-17 0-8 5-13 11-16 8-4 14-11 14-19C80 15 71 10 60 10Z" stroke="currentColor" stroke-width="8" stroke-linejoin="round"></path> </svg> </span> <span class="font-display text-sm font-medium text-ink-900">
Clínica RIM <span class="font-sans font-medium text-ink-400">· Painel</span> </span> </a> <nav class="flex items-center gap-1.5 sm:gap-3" aria-label="Navegação do painel"> <a href="/admin" class="rounded-md px-3 py-2 font-sans text-sm font-medium text-ink-600 hover:bg-azure-50 hover:text-azure-800">
Publicações
</a> <a href="/admin/novo" class="rounded-md px-3 py-2 font-sans text-sm font-medium text-ink-600 hover:bg-azure-50 hover:text-azure-800">
Novo artigo
</a> <a href="/blog" target="_blank" rel="noopener" class="hidden rounded-md px-3 py-2 font-sans text-sm font-medium text-ink-600 hover:bg-azure-50 hover:text-azure-800 sm:block">
Ver blog ↗
</a> <form method="post" action="/api/admin/logout"> <button type="submit" class="rounded-md border border-ink-200 px-4 py-2 font-sans text-sm font-medium text-ink-700 transition-colors hover:border-azure-300 hover:bg-azure-50">
Sair
</button> </form> </nav> </div> </header>`} <main class="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6"> ${renderSlot($$result, $$slots["default"])} </main> </body></html>`;
}, "D:/Cursos/medico_blog_astro-teste/src/layouts/AdminLayout.astro", void 0);

export { $$AdminLayout as $ };
