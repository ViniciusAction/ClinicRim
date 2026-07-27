/**
 * Extração do IP real do cliente atrás do proxy da Vercel.
 *
 * O socket sempre mostra o IP da borda da Vercel, nunca o do visitante. O IP
 * de verdade vem em cabeçalho. Usamos o PRIMEIRO valor de `x-forwarded-for`
 * (o cliente original; os seguintes são proxies intermediários).
 *
 * O valor é usado no rate limit de login e no log de auditoria, e vai para uma
 * coluna `inet` — daí a validação: string inválida faria o INSERT inteiro
 * falhar, derrubando o registro de auditoria junto.
 */

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

function isValidIp(value: string): boolean {
  if (IPV4.test(value)) {
    return value.split('.').every((octet) => Number(octet) <= 255);
  }
  // Checagem frouxa de IPv6: o Postgres valida de verdade, aqui só barramos
  // lixo que não tem chance de ser um endereço.
  return value.includes(':') && IPV6.test(value);
}

/** IP do cliente, ou `null` se não der para determinar com confiança. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const candidate = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim();

  if (!candidate) return null;

  // "::ffff:189.4.1.2" — IPv4 mapeado em IPv6, comum atrás de proxy.
  const unwrapped = candidate.startsWith('::ffff:') ? candidate.slice(7) : candidate;

  return isValidIp(unwrapped) ? unwrapped : null;
}

/** User-agent truncado — o header é livre e pode vir gigante de propósito. */
export function clientUserAgent(request: Request): string | null {
  return request.headers.get('user-agent')?.slice(0, 300) ?? null;
}
