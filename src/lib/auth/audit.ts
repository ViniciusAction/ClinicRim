import { db } from '@/lib/db';
import type { AuditAction, AuditLogRow } from '@/lib/db-types';

/**
 * Trilha de auditoria: quem fez o quê, quando e de onde.
 *
 * Serve a três coisas ao mesmo tempo:
 *  1. rastreabilidade — com 3 admins plenos, "quem excluiu esse artigo?"
 *     precisa ter resposta;
 *  2. rate limit de login — conta os `login_failed` recentes (ver rate-limit.ts);
 *  3. diagnóstico em produção, onde não há como anexar um debugger.
 *
 * ⚠️ `audit()` NUNCA lança. Falhar ao gravar log não pode impedir o médico de
 * entrar no painel nem de publicar. A falha vai para o console (visível nos
 * logs da Vercel) e a operação segue.
 */

export interface AuditEntry {
  action: AuditAction;
  /** Quem executou. `null` em login falhado, quando ainda não há usuário. */
  userId?: string | null;
  /** Alvo da ação: slug do post, e-mail tentado, id do usuário afetado. */
  target?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await db().from('admin_audit_log').insert({
      user_id: entry.userId ?? null,
      action: entry.action,
      target: entry.target ?? null,
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null,
    });

    if (error) console.error('[audit] falha ao gravar', entry.action, error.message);
  } catch (error) {
    console.error('[audit] exceção ao gravar', entry.action, (error as Error).message);
  }
}

export interface AuditItem extends Pick<AuditLogRow, 'id' | 'action' | 'target' | 'created_at'> {
  metadata: Record<string, unknown>;
  ip: string | null;
  actorName: string | null;
}

/**
 * Últimos eventos, mais recentes primeiro. Alimenta /admin/atividade.
 * Um único join — nada de buscar o nome do autor em loop (regra `data-n-plus-one`).
 */
export async function recentActivity(limit = 100): Promise<AuditItem[]> {
  const { data, error } = await db()
    .from('admin_audit_log')
    .select('id, action, target, metadata, ip, created_at, admin_users(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Não foi possível ler o histórico de atividade: ${error.message}`);

  return (data ?? []).map((row) => {
    const { admin_users: actor, ...rest } = row as typeof row & {
      admin_users: { name: string } | null;
    };
    return { ...rest, actorName: actor?.name ?? null } as AuditItem;
  });
}
