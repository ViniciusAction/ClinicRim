// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

/**
 * Carrega o .env para dentro do `process.env`, uma vez só, aqui.
 *
 * POR QUE ISSO EXISTE (não é conveniência — é o conserto de um vazamento)
 * Antes, `src/lib/db.ts` e `src/lib/admin/github.ts` liam os segredos com
 * `import.meta.env[key]` como fallback do process.env, para funcionar no
 * `npm run dev`. O problema: o Vite substitui `import.meta.env` em tempo de
 * build por um objeto LITERAL com os valores do .env. Como o acesso era
 * dinâmico (`[key]`), ele não podia substituir só a chave lida — inlinava o
 * objeto inteiro. Verificado com grep no dist: a SUPABASE_SERVICE_ROLE_KEY e o
 * GITHUB_TOKEN ficavam em texto puro em dist/server/chunks/db_*.mjs.
 *
 * Nunca chegou ao navegador (o bundle do cliente estava limpo), mas era
 * segredo de produção dentro de um artefato de build — que se copia, se
 * compacta em .zip para subir na Hostinger e se esquece numa pasta.
 *
 * Com o .env indo para o process.env aqui, o código da aplicação lê APENAS
 * process.env, em runtime. Não há mais nenhuma referência a `import.meta.env`
 * para inlinar, então não há mais o que vazar.
 *
 * `??=` de propósito: variável já definida no ambiente (Vercel, Hostinger, CI)
 * SEMPRE ganha do arquivo. Em produção não existe .env e este laço não faz nada.
 */
for (const [key, value] of Object.entries(
  loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), ''),
)) {
  process.env[key] ??= value;
}

/**
 * Escolha do host, por variável de ambiente.
 *
 * `DEPLOY_TARGET=node` → adapter Node (Hostinger). Qualquer outro valor, ou
 * nenhum, → Vercel. O default é a Vercel DE PROPÓSITO: a preview no ar hoje
 * continua buildando e publicando sem que ninguém precise definir nada.
 *
 * POR QUE UMA CHAVE E NÃO TROCAR O ADAPTER DE UMA VEZ
 * Trocar direto derrubaria a preview da Vercel no próximo push, e a migração
 * ficaria sem rede de segurança. Com a chave, dá para subir na Hostinger,
 * testar o painel no domínio temporário e só então apontar o DNS — com a
 * Vercel servindo o site até o último minuto e disponível para voltar atrás.
 *
 * Na Hostinger: hPanel > Node.js > Environment variables > `DEPLOY_TARGET=node`.
 * O adapter Node em modo `standalone` sobe um servidor HTTP próprio (é o que a
 * Hostinger espera) e serve tanto as páginas pré-renderizadas do site quanto
 * as rotas sob demanda do /admin. Ele lê `HOST` e `PORT` do ambiente.
 */
const adapter = process.env.DEPLOY_TARGET === 'node' ? node({ mode: 'standalone' }) : vercel();

/**
 * O site público é estático (SSG). Renderizadas sob demanda são apenas a área
 * restrita (`/admin`, `/api/admin`) e as páginas do blog, que leem os artigos
 * do Postgres — ver src/lib/blog.ts.
 *
 * `site` é obrigatório para o sitemap, o RSS e as URLs absolutas de Open Graph.
 */
export default defineConfig({
  /**
   * Domínio canônico: `www`.
   *
   * ⚠️ Este valor precisa casar com o domínio de PRODUÇÃO configurado na
   * Vercel. Ele alimenta o sitemap, o RSS e as URLs absolutas de Open Graph (a
   * prévia de link no WhatsApp e nas redes sociais). Se apontar para o lado
   * errado, todas essas URLs levam a um endereço que redireciona — o site
   * funciona, mas cada link publicado dá um salto a mais, e o canônico do HTML
   * discorda de onde a página realmente mora.
   *
   * Na Vercel (Settings > Domains) está assim:
   *   www.clinicarim.com.br  → Production   (serve o site)
   *   clinicarim.com.br      → 308 → www    (redireciona)
   *
   * O site anterior, em WordPress, canonicalizava no apex. Trocamos para `www`
   * porque é o que a Vercel configurou ao adicionar o domínio, e porque a
   * escolha entre os dois é indiferente para SEO desde que seja CONSISTENTE —
   * o que importa é não haver divergência entre este valor e o host de
   * produção. O conteúdo indexado do site antigo era uma página "em breve",
   * então não havia histórico a preservar no apex.
   *
   * Se algum dia inverter na Vercel, inverta aqui e em public/robots.txt.
   */
  site: 'https://www.clinicarim.com.br',

  adapter,

  security: {
    /**
     * Necessário atrás de proxy (Vercel e Hostinger): sem esta lista o Astro
     * descarta os cabeçalhos `x-forwarded-host` / `x-forwarded-proto`, cai no
     * fallback `localhost` e passa a calcular `Astro.url` como
     * `https://localhost` — o que estraga URLs absolutas e redirecionamentos.
     *
     * Mantemos os dois hosts durante a migração: a preview da Vercel segue no
     * ar enquanto a Hostinger é montada e testada.
     *
     * `*.vercel.app`        alias de produção e URLs de preview da Vercel.
     * `*.hostingersite.com` domínio temporário que a Hostinger dá antes do DNS
     *                       apontar — é NELE que o painel será testado, e sem
     *                       esta entrada o teste falharia por um motivo que não
     *                       tem nada a ver com a Hostinger.
     */
    allowedDomains: [
      { protocol: 'https', hostname: '*.vercel.app' },
      { protocol: 'https', hostname: '*.hostingersite.com' },
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
    // Permite páginas .mdx. Os artigos do blog NÃO usam mais isto — eles vivem
    // no Postgres (ver src/lib/blog.ts); ficou para páginas avulsas em .mdx.
    mdx(),

    /**
     * Gera /sitemap-index.xml no build, com as páginas estáticas.
     *
     * O `filter` não é zelo excessivo: sem ele, o sitemap listava
     * `/admin/`, `/admin/login/`, `/admin/novo/`, `/admin/conta/` e
     * `/admin/usuarios/` — verificado na saída do build. Essas páginas são
     * `noindex` e bloqueadas no robots.txt, então o sitemap estava ao mesmo
     * tempo pedindo que fossem indexadas e proibindo — sinal contraditório para
     * o buscador — e, de passagem, publicando num arquivo XML aberto o mapa
     * exato da área restrita.
     *
     * Os artigos do blog não entram aqui: são rotas sob demanda, que o build
     * não conhece. Eles têm o próprio sitemap em src/pages/sitemap-blog.xml.ts,
     * e os dois estão declarados em public/robots.txt.
     */
    sitemap({
      filter: (page) => !/\/(admin|api)(\/|$)/.test(new URL(page).pathname),
    }),
  ],

  vite: {
    // Tailwind v4 via plugin oficial do Vite (substitui o antigo @astrojs/tailwind).
    plugins: [tailwindcss()],
  },
});
