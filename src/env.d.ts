/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /**
     * Médico logado no painel, populado pelo middleware em toda rota
     * /admin/* e /api/admin/*. É `null` na tela de login; nas demais rotas
     * protegidas o middleware já redirecionou quem não tem sessão, então lá
     * pode ser tratado como sempre presente.
     */
    user: import('@/lib/db-types').SessionUser | null;
  }
}

/**
 * NÃO declare os segredos (SUPABASE_*, GITHUB_*) aqui.
 *
 * Existia um `ImportMetaEnv` com SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e
 * VERCEL_DEPLOY_HOOK_URL. Foi removido por dois motivos:
 *
 *  1. Declarar convida a ler por `import.meta.env.X` — e o Vite inlina esses
 *     valores no bundle em tempo de build, gravando a chave de administrador do
 *     banco em texto puro no dist. Segredo se lê de `process.env`, em runtime,
 *     pelo helper `env()` de src/lib/db.ts. O tipo aqui só facilitava o erro.
 *
 *  2. VERCEL_DEPLOY_HOOK_URL nunca foi usado por nenhuma linha de código: o
 *     rebuild é disparado pelo push que o painel faz no repositório, não por
 *     deploy hook. Era configuração fantasma no .env.example.
 *
 * `import.meta.env.PROD` / `.DEV` continuam tipados — vêm de `astro/client`.
 */
