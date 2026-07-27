import type { APIRoute } from 'astro';
import { db, dbConfigError } from '@/lib/db';

export const prerender = false;

/**
 * Health check do backend.
 *
 * Dois papéis:
 *  1. DIAGNÓSTICO — resposta rápida a "o painel está fora do ar ou é o banco?".
 *  2. KEEP-ALIVE — um projeto Supabase no plano gratuito é PAUSADO após 7 dias
 *     sem nenhuma atividade. Uma clínica que publica uma vez por mês cairia
 *     nisso e o painel apareceria quebrado justamente quando fosse usado.
 *     O cron diário em vercel.json bate aqui e mantém o projeto acordado.
 *     (No plano Pro da Supabase não há pausa, mas o endpoint segue útil.)
 *
 * Fica FORA de /api/admin de propósito: precisa responder sem sessão, para o
 * cron e para monitoramento externo. Por isso a resposta é deliberadamente
 * pobre — só ok/erro, sem versão, sem mensagem do Postgres, sem nome de tabela.
 */
export const GET: APIRoute = async () => {
  const respond = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

  if (dbConfigError()) return respond(503, { status: 'unconfigured' });

  try {
    // head + count: acorda o Postgres com o menor trabalho possível e sem
    // trafegar dado nenhum.
    const { error } = await db()
      .from('admin_users')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.error('[health] banco indisponível:', error.message);
      return respond(503, { status: 'degraded' });
    }

    return respond(200, { status: 'ok' });
  } catch (error) {
    console.error('[health] exceção:', (error as Error).message);
    return respond(503, { status: 'error' });
  }
};
