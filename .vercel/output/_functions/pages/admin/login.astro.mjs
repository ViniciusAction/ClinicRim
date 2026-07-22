import { b as createAstro, c as createComponent, r as renderComponent, a as renderTemplate, m as maybeRenderHead } from '../../chunks/astro/server_BUPcWb2m.mjs';
import 'piccolore';
import { $ as $$AdminLayout } from '../../chunks/AdminLayout_K6mZeHzV.mjs';
import { c as checkCredentials, S as SESSION_COOKIE, a as createSessionToken, s as sessionCookieOptions } from '../../chunks/auth_toOKJSnr.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro("https://www.clinicarim.com.br");
const prerender = false;
const $$Login = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Login;
  let error = null;
  if (Astro2.request.method === "POST") {
    const form = await Astro2.request.formData();
    const user = String(form.get("user") ?? "");
    const password = String(form.get("password") ?? "");
    if (checkCredentials(user, password)) {
      Astro2.cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
      return Astro2.redirect("/admin");
    }
    error = "Usu\xE1rio ou senha incorretos.";
  }
  return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, { "title": "Entrar", "bare": true }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="bg-hero-mesh fixed inset-0 -z-10" aria-hidden="true"></div> <div class="mx-auto mt-10 w-full max-w-sm sm:mt-20"> <div class="rounded-2xl border border-ink-100 bg-white p-8"> <div class="flex flex-col items-center text-center"> <span class="flex size-12 items-center justify-center rounded-md bg-azure-600 text-white"> <svg class="size-6" viewBox="0 0 96 96" fill="none" aria-hidden="true"> <path d="M60 10c-19 0-34 16-34 37 0 16 9 27 21 31 6 2 12 2 17-1-6-4-9-10-9-17 0-8 5-13 11-16 8-4 14-11 14-19C80 15 71 10 60 10Z" stroke="currentColor" stroke-width="8" stroke-linejoin="round"></path> </svg> </span> <h1 class="mt-4 font-display text-xl font-medium text-ink-900">Área da equipe</h1> <p class="mt-1 font-sans text-sm text-ink-500">
Acesso restrito para publicação de conteúdo no blog.
</p> </div> ${error && renderTemplate`<p role="alert" class="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700"> ${error} </p>`} <form method="post" class="mt-6 space-y-4"> <div> <label for="user" class="mb-1.5 block font-sans text-sm font-medium text-ink-900">
Usuário
</label> <input id="user" name="user" type="text" required autocomplete="username" class="block w-full rounded-md border border-ink-200 bg-white px-4 py-2.5 font-sans text-sm text-ink-900 focus:border-azure-400 focus:ring-2 focus:ring-azure-400 focus:outline-none"> </div> <div> <label for="password" class="mb-1.5 block font-sans text-sm font-medium text-ink-900">
Senha
</label> <input id="password" name="password" type="password" required autocomplete="current-password" class="block w-full rounded-md border border-ink-200 bg-white px-4 py-2.5 font-sans text-sm text-ink-900 focus:border-azure-400 focus:ring-2 focus:ring-azure-400 focus:outline-none"> </div> <button type="submit" class="inline-flex h-11 w-full items-center justify-center rounded-md bg-azure-600 font-sans text-sm font-medium text-white transition-all hover:bg-azure-500 focus-visible:ring-2 focus-visible:ring-azure-500 focus-visible:ring-offset-2 focus-visible:outline-none">
Entrar no painel
</button> </form> </div> <p class="mt-6 text-center font-sans text-xs text-ink-400"> <a href="/" class="hover:text-azure-700">← Voltar ao site</a> </p> </div> ` })}`;
}, "D:/Cursos/medico_blog_astro-teste/src/pages/admin/login.astro", void 0);

const $$file = "D:/Cursos/medico_blog_astro-teste/src/pages/admin/login.astro";
const $$url = "/admin/login";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Login,
  file: $$file,
  prerender,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
