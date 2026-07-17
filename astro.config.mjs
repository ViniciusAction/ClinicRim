// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/serverless';
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
