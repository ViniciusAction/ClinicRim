import { db } from '@/lib/db';
import type { AdminUserRow, DoctorId, SessionUser } from '@/lib/db-types';
import { audit } from './audit';
import {
  generateTemporaryPassword,
  hashPassword,
  needsRehash,
  validatePassword,
  verifyPassword,
} from './password';
import { checkLoginRateLimit } from './rate-limit';
import { createSession, revokeAllForUser, type SessionContext } from './session';

/**
 * Usuários do painel: os 3 médicos + contas de equipe, todos com o mesmo poder.
 *
 * Não existe tabela de papéis nem verificação de permissão em lugar nenhum —
 * é intencional. O requisito é que todo mundo com acesso possa fazer tudo. A
 * única distinção que o código faz é "é você mesmo?" (trocar a própria senha)
 * versus "é outra pessoa?" (redefinir a senha de um colega).
 *
 * MÉDICO versus CONTA DE EQUIPE
 * `doctorId` liga a conta ao perfil público em src/data/doctors.ts e vale
 * `null` para quem não é médico (agência, secretaria). É vínculo de perfil,
 * NUNCA permissão: o autor do artigo é escolhido no formulário, então uma
 * conta de equipe publica normalmente, atribuindo o texto ao médico certo.
 *
 * RECUPERAÇÃO DE SENHA SEM E-MAIL
 * Como todos são admin plenos, quem esquece a senha pede a um colega, que
 * redefine em /admin/usuarios e informa a senha temporária. Isso elimina a
 * necessidade de provedor de e-mail transacional, de token de recuperação com
 * expiração e de toda a superfície de ataque que vem junto.
 */

/**
 * Hash descartável usado quando o e-mail não existe.
 *
 * Sem isso, "e-mail inexistente" responderia em ~5 ms e "senha errada" em
 * ~100 ms — diferença suficiente para descobrir quais e-mails têm conta.
 * Verificar contra este hash constante iguala o tempo das duas respostas.
 */
const DUMMY_HASH =
  'scrypt$16384$8$1$ms20Gu3U58sbHhvxYfxthA$MbsvInamCS9lralygOsMBjRfjsZlIDO6oIH9MGX4hLP3Epp-z1QvKusLxejkV0VQAv6TjVWKgFyWqfi8m44ebw';

/** Mensagem única para todo login recusado — não revela se o e-mail existe. */
const GENERIC_LOGIN_ERROR = 'E-mail ou senha incorretos.';

export type LoginResult =
  { ok: true; token: string; user: SessionUser } | { ok: false; message: string };

export async function authenticate(
  rawEmail: string,
  password: string,
  context: SessionContext = {},
): Promise<LoginResult> {
  const email = rawEmail.trim().toLowerCase();

  if (!email || !password) return { ok: false, message: GENERIC_LOGIN_ERROR };

  const rateLimit = await checkLoginRateLimit(email, context.ip ?? null);
  if (rateLimit.limited) return { ok: false, message: rateLimit.message! };

  const { data, error } = await db()
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('[auth] falha ao buscar usuário:', error.message);
    return { ok: false, message: 'Não foi possível validar o acesso agora. Tente novamente.' };
  }

  const user = data as AdminUserRow | null;

  // Conta inexistente e conta desativada seguem o MESMO caminho de uma senha
  // errada, inclusive no custo de CPU. De fora, os três casos são idênticos.
  const valid = await verifyPassword(password, user?.active ? user.password_hash : DUMMY_HASH);

  if (!user || !user.active || !valid) {
    await audit({
      action: 'login_failed',
      userId: user?.id ?? null,
      target: email,
      ip: context.ip,
      metadata: { reason: !user ? 'unknown_email' : !user.active ? 'inactive' : 'bad_password' },
    });
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  // Se o custo do scrypt foi endurecido desde o último login, aproveita que a
  // senha em claro está em mãos e regrava o hash com os parâmetros atuais.
  const patch: Partial<AdminUserRow> = { last_login_at: new Date().toISOString() };
  if (needsRehash(user.password_hash)) patch.password_hash = await hashPassword(password);

  await db().from('admin_users').update(patch).eq('id', user.id);

  const token = await createSession(user.id, context);
  await audit({ action: 'login', userId: user.id, target: email, ip: context.ip });

  return {
    ok: true,
    token,
    user: {
      id: user.id,
      doctorId: user.doctor_id,
      email: user.email,
      name: user.name,
      mustChangePassword: user.must_change_password,
      sessionId: '',
    },
  };
}

/* ── Gestão de senha ───────────────────────────────────────────────────────── */

export type PasswordChangeResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Troca da própria senha. Exige a senha atual mesmo já estando logado: sem
 * isso, uma sessão sequestrada tomaria a conta de forma permanente.
 */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  context: { ip?: string | null; keepSessionId?: string } = {},
): Promise<PasswordChangeResult> {
  const { data, error } = await db()
    .from('admin_users')
    .select('id, email, name, password_hash')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return { ok: false, errors: ['Não foi possível carregar a sua conta.'] };

  const user = data as Pick<AdminUserRow, 'id' | 'email' | 'name' | 'password_hash'>;

  if (!(await verifyPassword(currentPassword, user.password_hash))) {
    await audit({
      action: 'password.change',
      userId,
      ip: context.ip,
      metadata: { result: 'wrong_current_password' },
    });
    return { ok: false, errors: ['A senha atual está incorreta.'] };
  }

  if (await verifyPassword(newPassword, user.password_hash)) {
    return { ok: false, errors: ['A nova senha precisa ser diferente da atual.'] };
  }

  const problems = validatePassword(newPassword, { email: user.email, name: user.name });
  if (problems.length > 0) return { ok: false, errors: problems };

  const { error: updateError } = await db()
    .from('admin_users')
    .update({ password_hash: await hashPassword(newPassword), must_change_password: false })
    .eq('id', userId);

  if (updateError)
    return { ok: false, errors: [`Não foi possível salvar: ${updateError.message}`] };

  // Derruba as outras sessões, mantendo a atual: se alguém tinha acesso
  // indevido, a troca de senha o expulsa de fato.
  await revokeAllForUser(userId, context.keepSessionId);
  await audit({ action: 'password.change', userId, ip: context.ip, metadata: { result: 'ok' } });

  return { ok: true };
}

/**
 * Redefinição feita por um colega. Devolve a senha temporária UMA única vez —
 * ela não é recuperável depois, só substituível por outra redefinição.
 */
export async function resetPasswordFor(
  actorId: string,
  targetUserId: string,
  context: { ip?: string | null } = {},
): Promise<{ ok: true; temporaryPassword: string } | { ok: false; message: string }> {
  if (actorId === targetUserId) {
    return {
      ok: false,
      message: 'Para trocar a própria senha, use a página "Minha conta".',
    };
  }

  const temporaryPassword = generateTemporaryPassword();

  const { data, error } = await db()
    .from('admin_users')
    .update({
      password_hash: await hashPassword(temporaryPassword),
      // Força a troca no primeiro acesso: ninguém fica com uma senha que
      // outra pessoa conhece.
      must_change_password: true,
    })
    .eq('id', targetUserId)
    .select('email')
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: `Não foi possível redefinir a senha: ${error?.message ?? 'usuário não encontrado'}`,
    };
  }

  // A senha antiga não vale mais — as sessões abertas com ela também não.
  await revokeAllForUser(targetUserId);
  await audit({
    action: 'password.reset',
    userId: actorId,
    target: (data as { email: string }).email,
    ip: context.ip,
  });

  return { ok: true, temporaryPassword };
}

/* ── Gestão de contas ──────────────────────────────────────────────────────── */

export interface AdminUserSummary {
  id: string;
  /** `null` = conta de equipe, sem perfil de médico no site. */
  doctorId: DoctorId | null;
  email: string;
  name: string;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export async function listUsers(): Promise<AdminUserSummary[]> {
  const { data, error } = await db()
    .from('admin_users')
    .select('id, doctor_id, email, name, active, must_change_password, last_login_at')
    .order('name');

  if (error) throw new Error(`Não foi possível listar os usuários: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    doctorId: row.doctor_id as DoctorId | null,
    email: row.email as string,
    name: row.name as string,
    active: row.active as boolean,
    mustChangePassword: row.must_change_password as boolean,
    lastLoginAt: row.last_login_at as string | null,
  }));
}

/**
 * Ativa/desativa uma conta.
 * Desativar derruba as sessões na hora — é a ação de emergência para
 * "notebook do médico foi roubado".
 */
export async function setUserActive(
  actorId: string,
  targetUserId: string,
  active: boolean,
  context: { ip?: string | null } = {},
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (actorId === targetUserId) {
    return { ok: false, message: 'Você não pode desativar a sua própria conta.' };
  }

  // Trava de segurança: nunca deixar o painel sem ninguém que consiga entrar.
  if (!active) {
    const { count } = await db()
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('active', true);

    if ((count ?? 0) <= 1) {
      return { ok: false, message: 'Não é possível desativar o último acesso ativo do painel.' };
    }
  }

  const { data, error } = await db()
    .from('admin_users')
    .update({ active })
    .eq('id', targetUserId)
    .select('email')
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: `Não foi possível alterar o acesso: ${error?.message ?? 'usuário não encontrado'}`,
    };
  }

  if (!active) await revokeAllForUser(targetUserId);

  await audit({
    action: active ? 'user.activate' : 'user.deactivate',
    userId: actorId,
    target: (data as { email: string }).email,
    ip: context.ip,
  });

  return { ok: true };
}
