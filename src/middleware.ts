import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, resolveSession } from '@/lib/auth';
import { dbConfigError } from '@/lib/db';

/**
 * Porteiro da área restrita.
 *
 * Cobre `/admin/*` E `/api/admin/*` — o middleware antigo olhava só o primeiro,
 * então qualquer endpoint de API novo nasceria desprotegido. Aqui, tudo que
 * for administrativo passa por este ponto único.
 *
 * As páginas públicas são pré-renderizadas e passam direto: o site no ar não
 * toca o banco em requisição nenhuma de visitante.
 */

/** Rotas administrativas que dispensam sessão. */
const PUBLIC_ADMIN_PATHS = new Set(['/admin/login']);

/**
 * Rotas liberadas para quem está com senha temporária.
 * Sem isso, o redirecionamento forçado para /admin/conta impediria o próprio
 * ato de trocar a senha — e o médico ficaria preso num laço.
 */
const ALLOWED_WHILE_MUST_CHANGE = new Set(['/admin/conta', '/api/admin/logout']);

/** Caminho sem barra final, para comparar sem depender de `trailingSlash`. */
function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

/** Métodos que alteram estado e, por isso, exigem verificação de origem. */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Proteção CSRF — substitui o `security.checkOrigin` do Astro.
 *
 * Compara o `Origin` enviado pelo navegador com o host que o cliente
 * REALMENTE pediu, lido de `x-forwarded-host` (o cabeçalho que o proxy da
 * Vercel preenche) com fallback para `host`. Sem derivação intermediária: se
 * o navegador postou para este host, os dois valores batem por construção.
 *
 * Segunda camada de defesa (independente desta): o cookie de sessão é
 * SameSite=Lax, então o navegador nem envia a credencial num POST vindo de
 * outro site.
 *
 * Devolve `null` quando está tudo certo, ou a resposta 403 a enviar.
 */
function assertSameOrigin(request: Request): Response | null {
  if (!UNSAFE_METHODS.has(request.method)) return null;

  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';

  if (!host) {
    console.error('[csrf] requisição sem host — recusada');
    return new Response('Origem não verificável.', { status: 403 });
  }

  // O navegador manda `Origin` em todo POST, inclusive de mesma origem.
  // Ausência dele é sinal de cliente não-navegador, não de requisição legítima.
  const expected = `${proto}://${host}`;
  if (origin === expected) return null;

  console.error(
    '[csrf] origem recusada — Origin=%s esperado=%s (x-forwarded-host=%s, host=%s, proto=%s)',
    origin ?? '(ausente)',
    expected,
    forwardedHost ?? '(ausente)',
    request.headers.get('host') ?? '(ausente)',
    proto,
  );

  return new Response('Origem da requisição não confere. Recarregue a página e tente de novo.', {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Antes de qualquer coisa e para TODA rota renderizada sob demanda — não só
  // as de /admin — para que nenhuma rota futura nasça desprotegida.
  const csrfFailure = assertSameOrigin(context.request);
  if (csrfFailure) return csrfFailure;

  const path = normalize(context.url.pathname);
  const isAdminPage = path === '/admin' || path.startsWith('/admin/');
  const isAdminApi = path.startsWith('/api/admin/');

  if (!isAdminPage && !isAdminApi) return next();

  const isLoginPage = PUBLIC_ADMIN_PATHS.has(path);

  /** 401 para API, redirecionamento para página — API não deve devolver HTML. */
  const deny = (to: string) =>
    isAdminApi
      ? new Response('Não autorizado.', { status: 401, headers: { 'Cache-Control': 'no-store' } })
      : context.redirect(to);

  // Sem banco configurado não há como validar ninguém. A tela de login segue
  // acessível para explicar o que falta; o resto fecha (fail closed).
  if (dbConfigError()) {
    context.locals.user = null;
    return isLoginPage ? withAdminHeaders(await next()) : deny('/admin/login');
  }

  const user = await resolveSession(context.cookies.get(SESSION_COOKIE)?.value);
  context.locals.user = user;

  if (!user) {
    // Cookie inválido, expirado ou revogado: limpa para não reenviar a cada request.
    if (context.cookies.has(SESSION_COOKIE)) context.cookies.delete(SESSION_COOKIE, { path: '/' });
    return isLoginPage ? withAdminHeaders(await next()) : deny('/admin/login');
  }

  if (isLoginPage) return context.redirect('/admin');

  // Senha temporária (primeiro acesso ou redefinida por um colega): o painel
  // fica bloqueado até a troca.
  if (user.mustChangePassword && !ALLOWED_WHILE_MUST_CHANGE.has(path)) {
    return deny('/admin/conta?trocar=1');
  }

  return withAdminHeaders(await next());
});

/**
 * Cabeçalhos de segurança do painel.
 *
 * `no-store` é o mais importante: sem ele, um proxy ou o botão "voltar" do
 * navegador pode reexibir uma página do painel depois do logout.
 * A CSP é restritiva: a única origem externa liberada é o Google Fonts, que o
 * AdminLayout carrega. Sem CDN de script, sem analytics, sem iframe.
 */
function withAdminHeaders(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store, must-revalidate');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Astro injeta estilos inline nas páginas; scripts inline vêm dos
      // handlers de confirmação de exclusão. O AdminLayout usa Google Fonts.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join('; '),
  );
  return response;
}
