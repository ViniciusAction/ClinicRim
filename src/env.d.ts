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

interface ImportMetaEnv {
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly VERCEL_DEPLOY_HOOK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
