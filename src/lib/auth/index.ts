/**
 * Ponto de entrada da autenticação do painel.
 *
 * Substitui o antigo src/lib/auth.ts, que tinha um único usuário em variável
 * de ambiente e cookie HMAC auto-contido. Agora são 3 médicos com credenciais
 * próprias no Postgres, senha com hash scrypt e sessão revogável.
 *
 * Os módulos internos são acessíveis diretamente quando for preciso, mas as
 * páginas devem importar daqui.
 */
export { audit, recentActivity, type AuditEntry, type AuditItem } from './audit';

export {
  generateTemporaryPassword,
  hashPassword,
  validatePassword,
  verifyPassword,
} from './password';

export { LOGIN_RATE_LIMIT } from './rate-limit';

export {
  SESSION_COOKIE,
  createSession,
  listActiveSessions,
  purgeExpiredSessions,
  resolveSession,
  revokeAllForUser,
  revokeSession,
  sessionCookieOptions,
  type ActiveSession,
  type SessionContext,
} from './session';

export {
  authenticate,
  changeOwnPassword,
  listUsers,
  resetPasswordFor,
  setUserActive,
  type AdminUserSummary,
  type LoginResult,
} from './users';
