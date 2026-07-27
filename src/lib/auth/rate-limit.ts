import { db } from '@/lib/db';

/**
 * Limite de tentativas de login.
 *
 * O painel antigo não tinha nenhum: dava para varrer senhas contra
 * /admin/login à vontade. Como toda a autenticação agora passa pelo banco, o
 * contador sai de graça do log de auditoria — sem Redis, sem serviço extra.
 *
 * Duas janelas, propósitos diferentes:
 *  · por E-MAIL — protege UMA conta de ataque dirigido. Limite baixo.
 *  · por IP     — protege TODAS as contas de varredura. Limite mais alto,
 *                 porque os 3 médicos podem sair pelo mesmo IP da clínica e
 *                 errar a senha algumas vezes num dia normal.
 *
 * As duas consultas batem no índice parcial `admin_audit_log_failed_*_idx`,
 * então continuam baratas justamente quando a tabela cresce sob ataque.
 */

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 15;

export interface RateLimitVerdict {
  limited: boolean;
  /** Mensagem pronta para a tela de login. */
  message?: string;
}

async function countFailures(column: 'ip' | 'target', value: string, since: string) {
  // head: true = só o COUNT, sem trafegar linha nenhuma.
  const { count, error } = await db()
    .from('admin_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'login_failed')
    .eq(column, value)
    .gte('created_at', since);

  if (error) {
    // Fail OPEN, e de propósito: se o banco estiver instável, é pior travar os
    // 3 médicos para fora do painel do que aceitar uma janela sem rate limit.
    // A senha continua sendo verificada normalmente.
    console.error('[rate-limit] falha ao contar tentativas:', error.message);
    return 0;
  }

  return count ?? 0;
}

/** Consulta antes de verificar a senha. */
export async function checkLoginRateLimit(
  email: string,
  ip: string | null,
): Promise<RateLimitVerdict> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const [byEmail, byIp] = await Promise.all([
    countFailures('target', email.toLowerCase(), since),
    ip ? countFailures('ip', ip, since) : Promise.resolve(0),
  ]);

  if (byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP) {
    return {
      limited: true,
      message:
        `Muitas tentativas de acesso. Aguarde ${WINDOW_MINUTES} minutos e tente de novo. ` +
        'Se esqueceu a senha, peça a outro médico da equipe para redefini-la no painel.',
    };
  }

  return { limited: false };
}

export const LOGIN_RATE_LIMIT = {
  windowMinutes: WINDOW_MINUTES,
  maxPerEmail: MAX_FAILURES_PER_EMAIL,
  maxPerIp: MAX_FAILURES_PER_IP,
} as const;
