// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// O site público continua estático (SSG) — todas as páginas são prerenderizadas.
// O adapter Node existe APENAS para a área restrita (/admin), que usa
// `export const prerender = false` (login + painel que grava posts como
// markdown em src/content/blog).
// `site` é obrigatório para o sitemap, o RSS e as URLs absolutas de Open Graph.
export default defineConfig({
  // TODO: confirmar o domínio final de produção (impacta sitemap, RSS e OG).
  site: 'https://www.clinicarim.com.br',

  adapter: vercel(),

  security: {
    /**
     * OBRIGATÓRIO atrás de proxy (Vercel) — não é ajuste fino de segurança.
     *
     * O Astro só confia nos cabeçalhos `x-forwarded-host` / `x-forwarded-proto`
     * se o host bater com algum padrão desta lista. Com a lista VAZIA (o
     * default), ele descarta o host encaminhado, cai no fallback `localhost` e
     * passa a calcular a própria origem como `https://localhost`.
     *
     * A consequência é silenciosa e total: a proteção CSRF embutida
     * (`security.checkOrigin`, ligada por padrão) compara o cabeçalho `Origin`
     * do navegador com essa origem inventada, nunca bate, e TODO envio de
     * formulário responde 403 — login, publicar e excluir, todos quebrados em
     * produção. Não aparece em `npm run dev`, porque essa checagem só existe no
     * runtime SSR.
     *
     * `*.vercel.app` cobre tanto o alias de produção quanto as URLs geradas a
     * cada deploy de preview.
     */
    allowedDomains: [
      { protocol: 'https', hostname: '*.vercel.app' },
      { protocol: 'https', hostname: 'clinicarim.com.br' },
      { protocol: 'https', hostname: '*.clinicarim.com.br' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },

  integrations: [
    // Ilhas interativas (acordeões, formulário, mapa).
    react(),
    // Permite posts do blog em .mdx além de .md.
    mdx(),
    // Gera /sitemap-index.xml automaticamente no build.
    sitemap(),
  ],

  vite: {
    // Tailwind v4 via plugin oficial do Vite (substitui o antigo @astrojs/tailwind).
    plugins: [tailwindcss()],
  },
});
