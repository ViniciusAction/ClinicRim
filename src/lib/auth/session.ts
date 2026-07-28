import { createHash, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import type { DoctorId, SessionUser } from '@/lib/db-types';

/**
 * Sessões do painel — armazenadas no banco e revogáveis uma a uma.
 *
 * O QUE MUDOU EM RELAÇÃO AO MODELO ANTIGO
 * Antes o cookie era um token auto-contido assinado por HMAC. Isso significava
 * que a única forma de invalidar uma sessão era trocar o AUTH_SECRET — o que
 * derrubava os três médicos ao mesmo tempo. Aqui o cookie carrega um token
 * opaco e aleatório, e o estado vive no banco: dá para encerrar uma sessão
 * específica (notebook perdido) sem afetar ninguém.
 *
 * O banco guarda apenas o SHA-256 do token. Um dump vazado não contém nada
 * que sirva de credencial. Não precisa de salt nem de KDF caro aqui: o token
 * já tem 256 bits de entropia, então não existe ataque de dicionário contra ele.
 */

export const SESSION_COOKIE = 'rim_admin_session';

const SESSION_HOURS = 12;

/** Abaixo disto, a sessão é renovada em silêncio (janela deslizante). */
const RENEW_BELOW_HOURS = 6;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

/**
 * Abre uma sessão e devolve o token que vai no cookie.
 * O valor em claro só existe aqui — depois disso, só o hash.
 */
export async function createSession(userId: string, context: SessionContext = {}): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);

  const { error } = await db()
    .from('admin_sessions')
    .insert({
      user_id: userId,
      token_hash: hashToken(token),
      user_agent: context.userAgent ?? null,
      ip: context.ip ?? null,
      expires_at: expiresAt.toISOString(),
    });

  if (error) throw new Error(`Não foi possível abrir a sessão: ${error.message}`);

  return token;
}

interface SessionJoinRow {
  id: string;
  expires_at: string;
  admin_users: {
    id: string;
    doctor_id: DoctorId | null;
    email: string;
    name: string;
    active: boolean;
    must_change_password: boolean;
  } | null;
}

/**
 * Traduz o cookie no usuário logado, ou `null`.
 *
 * Um único round-trip: o join traz o usuário junto, e os filtros de expiração
 * e revogação vão no WHERE. Isso roda em TODA requisição a /admin, então não
 * pode virar duas ou três consultas.
 */
export async function resolveSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  const { data, error } = await db()
    .from('admin_sessions')
    .select(
      'id, expires_at, admin_users!inner(id, doctor_id, email, name, active, must_change_password)',
    )
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('[session] falha ao resolver sessão:', error.message);
    return null;
  }

  const row = data as SessionJoinRow | null;
  const user = row?.admin_users;

  // Conta desativada perde o acesso na requisição seguinte, sem precisar
  // caçar e revogar as sessões dela uma a uma.
  if (!row || !user || !user.active) return null;

  await renewIfExpiringSoon(row.id, row.expires_at);

  return {
    id: user.id,
    doctorId: user.doctor_id,
    email: user.email,
    name: user.name,
    mustChangePassword: user.must_change_password,
    sessionId: row.id,
  };
}

/**
 * Janela deslizante: quem está usando o painel não é deslogado no meio de um
 * artigo. Só grava quando falta pouco, para não fazer um UPDATE por requisição.
 */
async function renewIfExpiringSoon(sessionId: string, expiresAt: string): Promise<void> {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs > RENEW_BELOW_HOURS * 3600_000) return;

  const { error } = await db()
    .from('admin_sessions')
    .update({ expires_at: new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString() })
    .eq('id', sessionId);

  // Falha aqui é inofensiva: a sessão simplesmente expira no horário original.
  if (error) console.error('[session] falha ao renovar:', error.message);
}

/** Encerra uma sessão específica. Idempotente. */
export async function revokeSession(sessionId: string): Promise<void> {
  const { error } = await db()
    .from('admin_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', sessionId)
    .is('revoked_at', null);

  if (error) throw new Error(`Não foi possível encerrar a sessão: ${error.message}`);
}

/**
 * Encerra todas as sessões de um usuário.
 * Usado ao trocar/redefinir senha e ao desativar uma conta — trocar a senha
 * sem derrubar as sessões abertas deixaria o invasor logado.
 */
export async function revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
  let query = db()
    .from('admin_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null);

  if (exceptSessionId) query = query.neq('id', exceptSessionId);

  const { error } = await query;
  if (error) throw new Error(`Não foi possível encerrar as sessões: ${error.message}`);
}

export interface ActiveSession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

/** Sessões abertas de um usuário — alimenta /admin/conta. */
export async function listActiveSessions(
  userId: string,
  currentSessionId: string,
): Promise<ActiveSession[]> {
  const { data, error } = await db()
    .from('admin_sessions')
    .select('id, user_agent, ip, created_at, expires_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Não foi possível listar as sessões: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    userAgent: row.user_agent as string | null,
    ip: row.ip as string | null,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    current: row.id === currentSessionId,
  }));
}

/** Opções do cookie de sessão. */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: import.meta.env.PROD,
  maxAge: SESSION_HOURS * 3600,
} as const;

/** Remove sessões vencidas há mais de 30 dias. Chamado pelo cron de manutenção. */
export async function purgeExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  const { data, error } = await db()
    .from('admin_sessions')
    .delete()
    .lt('expires_at', cutoff)
    .select('id');

  if (error) throw new Error(`Não foi possível limpar as sessões: ${error.message}`);
  return data?.length ?? 0;
}
