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
     * Necessário atrás de proxy (Vercel): sem esta lista o Astro descarta os
     * cabeçalhos `x-forwarded-host` / `x-forwarded-proto`, cai no fallback
     * `localhost` e passa a calcular `Astro.url` como `https://localhost` —
     * o que estraga URLs absolutas e redirecionamentos.
     *
     * `*.vercel.app` cobre o alias de produção e as URLs de preview.
     */
    allowedDomains: [
      { protocol: 'https', hostname: '*.vercel.app' },
      { protocol: 'https', hostname: 'clinicarim.com.br' },
      { protocol: 'https', hostname: '*.clinicarim.com.br' },
      { protocol: 'http', hostname: 'localhost' },
    ],

    /**
     * Proteção CSRF própria, em src/middleware.ts — ver `assertSameOrigin`.
     *
     * A checagem embutida do Astro compara o `Origin` do navegador com uma
     * origem DERIVADA (`Astro.url.origin`), que atrás de proxy depende de
     * cabeçalhos encaminhados e da lista acima. Quando essa derivação erra por
     * qualquer motivo, TODO formulário do site responde 403 — login inclusive —
     * e sem nenhuma pista no log. Foi exatamente o que aconteceu aqui.
     *
     * A nossa compara o `Origin` com o host que o cliente REALMENTE pediu
     * (`x-forwarded-host`, com fallback para `host`). Não há derivação para dar
     * errado, e toda recusa é registrada com os dois valores.
     */
    checkOrigin: false,
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
