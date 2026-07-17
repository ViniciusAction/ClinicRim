import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Autenticação da área restrita (/admin).
 *
 * Modelo simples e sem banco de dados: credencial única (usuário/senha) vinda
 * de variáveis de ambiente e sessão em cookie HttpOnly assinado com HMAC.
 * É suficiente para o painel interno da clínica; se um dia houver múltiplos
 * usuários, trocar por uma solução com storage (ex.: Lucia/Auth.js).
 *
 * ⚠️ Os defaults abaixo existem só para o `npm run dev` funcionar de primeira.
 * Em produção, defina ADMIN_USER / ADMIN_PASSWORD / AUTH_SECRET no .env.
 */
const ADMIN_USER = import.meta.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = import.meta.env.ADMIN_PASSWORD || 'rim2026';
const AUTH_SECRET = import.meta.env.AUTH_SECRET || 'dev-only-secret-clinica-rim';

export const SESSION_COOKIE = 'rim_admin_session';

/** Duração da sessão: 8 horas. */
const SESSION_MAX_AGE_S = 60 * 60 * 8;

function hmac(value: string): Buffer {
  return createHmac('sha256', AUTH_SECRET).update(value).digest();
}

/** Comparação em tempo constante (evita timing attack no login). */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(hmac(`cmp:${a}`), hmac(`cmp:${b}`));
}

export function checkCredentials(user: string, password: string): boolean {
  // & em vez de && para SEMPRE executar as duas comparações (tempo constante).
  return Boolean(Number(safeEqual(user, ADMIN_USER)) & Number(safeEqual(password, ADMIN_PASSWORD)));
}

/** Gera o token de sessão: base64url(payload) + assinatura HMAC. */
export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_S * 1000;
  const payload = Buffer.from(JSON.stringify({ user: ADMIN_USER, expiresAt })).toString(
    'base64url',
  );
  const signature = hmac(payload).toString('base64url');
  return `${payload}.${signature}`;
}

/** Valida assinatura e expiração do token de sessão. */
export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = hmac(payload).toString('base64url');
  if (!safeEqual(signature, expected)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      expiresAt?: number;
    };
    return typeof data.expiresAt === 'number' && data.expiresAt > Date.now();
  } catch {
    return false;
  }
}

/** Opções padrão do cookie de sessão (HttpOnly, escopo /, 8h). */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: import.meta.env.PROD,
  maxAge: SESSION_MAX_AGE_S,
} as const;
