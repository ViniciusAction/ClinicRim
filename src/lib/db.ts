import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase — SERVIDOR APENAS.
 *
 * ⚠️ REGRA MAIS IMPORTANTE DESTE ARQUIVO
 * Ele usa a SERVICE ROLE KEY, que ignora RLS e tem poder total sobre o banco.
 * Este módulo NUNCA pode ser importado por um componente React nem por
 * qualquer código que chegue ao navegador. Só rotas com `prerender = false`,
 * o middleware e os scripts de `scripts/`.
 *
 * A guarda logo abaixo transforma esse erro num crash imediato e óbvio em vez
 * de num vazamento silencioso da chave no bundle do cliente.
 *
 * POR QUE HTTP E NÃO CONEXÃO POSTGRES DIRETA
 * Cada requisição em serverless pode acordar uma instância nova da função. Com
 * driver TCP (`pg`), isso esgota o limite de conexões do Postgres rapidamente
 * — é o modo de falha clássico de Vercel + Postgres (regra `conn-pooling` da
 * skill supabase-postgres-best-practices). O supabase-js fala HTTP com o
 * PostgREST: sem pool, sem conexão ociosa, sem esse problema.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'src/lib/db.ts foi importado no navegador. Este módulo carrega a SERVICE_ROLE_KEY ' +
      'e é exclusivo do servidor — mova a consulta para uma rota com prerender = false.',
  );
}

/**
 * Lê variável de ambiente tanto no runtime da Vercel (process.env) quanto no
 * `npm run dev`, onde o Astro carrega o .env em import.meta.env.
 */
export function env(key: string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  if (fromProcess) return fromProcess;

  // `?.` porque os scripts de scripts/ rodam no Node puro, onde `import.meta.env`
  // não existe — sem isso, o acesso estouraria antes de chegar no process.env.
  return (import.meta.env as Record<string, string | undefined> | undefined)?.[key];
}

/**
 * Aponta a configuração faltante. `null` = tudo certo.
 * Login e painel usam isso para dizer o que fazer, em vez de estourar um
 * "fetch failed" incompreensível.
 */
export function dbConfigError(): string | null {
  const missing: string[] = [];
  if (!env('SUPABASE_URL')) missing.push('SUPABASE_URL');
  if (!env('SUPABASE_SERVICE_ROLE_KEY')) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length === 0) return null;

  return `Banco de dados não configurado: defina ${missing.join(' e ')} nas variáveis de ambiente (.env no local, Vercel > Settings > Environment Variables em produção).`;
}

let cached: SupabaseClient | null = null;

/**
 * Cliente memoizado por instância da função — criar um por requisição
 * desperdiça CPU de cold start sem ganho nenhum.
 */
export function db(): SupabaseClient {
  if (cached) return cached;

  const error = dbConfigError();
  if (error) throw new Error(error);

  cached = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: {
      // Não há usuário do Supabase Auth aqui: a sessão é nossa, em cookie
      // próprio. Sem isso, o cliente tentaria persistir/renovar token à toa.
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { 'X-Client-Info': 'clinica-rim-admin' },
    },
  });

  return cached;
}

/** Bucket das capas dos artigos (leitura pública, escrita só por service role). */
export const COVERS_BUCKET = 'blog-covers';
