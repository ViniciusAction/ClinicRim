import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, resolveSession } from '@/lib/auth';
import { dbConfigError, env } from '@/lib/db';

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
 * Primeiro valor de um cabeçalho que pode vir em lista.
 *
 * Com proxies em cadeia, `x-forwarded-host` chega como
 * "site.com.br, interno.local" — e o primeiro é o que o cliente pediu. Sem
 * isso, a string inteira era comparada com um host único e nunca batia.
 */
function firstValue(raw: string | null): string | null {
  const first = raw?.split(',')[0]?.trim();
  return first || null;
}

/**
 * Proteção CSRF — substitui o `security.checkOrigin` do Astro.
 *
 * Compara o HOST do `Origin` enviado pelo navegador com o host que o cliente
 * REALMENTE pediu, lido de `x-forwarded-host` (o cabeçalho que o proxy
 * preenche) com fallback para `host`.
 *
 * POR QUE COMPARA HOST, E NÃO A ORIGEM INTEIRA
 * A versão anterior montava `${proto}://${host}` com
 * `proto = x-forwarded-proto ?? 'https'` e exigia igualdade exata de string.
 * Aquele `?? 'https'` era um CHUTE sobre o comportamento do proxy: um host que
 * não mande o cabeçalho, ou que mande o esquema INTERNO (`http`) em vez do
 * externo, produz uma origem esperada errada — e todo POST do painel volta 403,
 * login incluído. Esse bug já custou dois hotfixes neste projeto (ver git log),
 * e trocar de host é justamente o momento em que ele reaparece.
 *
 * Comparar só o host elimina o chute: não há mais nada a derivar. E não perde
 * segurança — o que CSRF exige é que o documento que disparou o POST esteja no
 * NOSSO host. Um `Origin` com esquema diferente e host igual é o nosso próprio
 * site atrás de um proxy que reporta o esquema interno, não um site atacante.
 * Downgrade de esquema é problema de TLS/HSTS, resolvido pelo host, não aqui.
 *
 * Segunda camada de defesa (independente desta): o cookie de sessão é
 * SameSite=Lax, então o navegador nem envia a credencial num POST vindo de
 * outro site.
 *
 * Devolve `null` quando está tudo certo, ou a resposta 403 a enviar.
 */
function assertSameOrigin(request: Request): Response | null {
  if (!UNSAFE_METHODS.has(request.method)) return null;

  const forwardedHost = firstValue(request.headers.get('x-forwarded-host'));
  const host = forwardedHost ?? firstValue(request.headers.get('host'));

  if (!host) {
    console.error('[csrf] requisição sem host — recusada');
    return new Response('Origem não verificável.', { status: 403 });
  }

  const origin = request.headers.get('origin');
  const secFetchSite = request.headers.get('sec-fetch-site');

  // Sinal 1: o host do `Origin` bate com o host pedido. É o caso normal.
  // `URL` porque comparar strings à mão erra em porta e em `Origin: null`.
  if (origin && origin !== 'null') {
    try {
      if (new URL(origin).host === host) return null;
    } catch {
      // Origin malformado: cai nos sinais seguintes em vez de estourar 500.
    }
  }

  /**
   * Sinal 2: `Sec-Fetch-Site: same-origin`.
   *
   * Necessário porque `Origin` NEM SEMPRE traz a origem real num envio de
   * formulário: pela spec do Fetch, sob `Referrer-Policy: no-referrer` o
   * navegador serializa a origem como a string "null". Uma política de
   * privacidade mais rígida — nossa ou do usuário — apaga justamente o dado
   * que a verificação usa. Depender só do `Origin` é frágil.
   *
   * `Sec-Fetch-Site` é um cabeçalho de metadados que o navegador calcula e
   * que JavaScript de página NÃO consegue forjar. Um atacante com curl até
   * consegue enviá-lo, mas isso não é CSRF: CSRF exige o navegador da vítima
   * mandando os cookies dela, e é exatamente esse caminho que este sinal
   * fecha.
   */
  if (secFetchSite === 'same-origin') return null;

  console.error(
    '[csrf] recusado — Origin=%s host-esperado=%s sec-fetch-site=%s (x-forwarded-host=%s, host=%s)',
    origin ?? '(ausente)',
    host,
    secFetchSite ?? '(ausente)',
    forwardedHost ?? '(ausente)',
    request.headers.get('host') ?? '(ausente)',
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
 * Origem do Supabase Storage (`https://<ref>.supabase.co`), para a CSP.
 *
 * Só o esquema + host: a CSP não aceita caminho como fonte, e mesmo se
 * aceitasse não faria diferença. Devolve string vazia quando a variável não
 * está definida, para o item ser descartado em vez de virar uma diretiva
 * quebrada como `img-src 'self' undefined`.
 */
function storageOrigin(): string {
  const url = env('SUPABASE_URL');
  if (!url) return '';

  try {
    return new URL(url).origin;
  } catch {
    console.error('[csp] SUPABASE_URL não é uma URL válida — origem omitida da CSP');
    return '';
  }
}

/**
 * Cabeçalhos de segurança do painel.
 *
 * `no-store` é o mais importante: sem ele, um proxy ou o botão "voltar" do
 * navegador pode reexibir uma página do painel depois do logout.
 * A CSP é restritiva: as únicas origens externas liberadas são o Google Fonts,
 * que o AdminLayout carrega, e o Storage do Supabase, de onde vêm as capas.
 * Sem CDN de script, sem analytics, sem iframe.
 */
function withAdminHeaders(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store, must-revalidate');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  /**
   * `same-origin`, e NÃO `no-referrer`.
   *
   * Com `no-referrer`, o Chrome passa a enviar `Origin: null` nos envios de
   * formulário desta página (é o que a spec do Fetch determina) — o que
   * derrubava a verificação de origem e devolvia 403 em todo login. O ganho de
   * privacidade era nulo: `same-origin` já impede que qualquer referrer vaze
   * para fora do site, que é a única coisa que importa aqui.
   */
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Astro injeta estilos inline nas páginas; scripts inline vêm dos
      // handlers de confirmação de exclusão. O AdminLayout usa Google Fonts.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline'",
      /**
       * A origem do Supabase Storage entra aqui porque é de lá que vêm as capas
       * dos artigos. A pré-visualização do editor renderiza o HTML real do
       * artigo, e com `img-src 'self'` puro a capa apareceria quebrada na prévia
       * e correta no site — uma prévia que mente, que é o defeito que ela existe
       * para não ter.
       *
       * Só a origem do NOSSO projeto, montada da variável de ambiente. Não é
       * `https:` genérico: liberar qualquer host para imagem no painel deixaria
       * o conteúdo de um artigo buscar recurso de fora, e uma URL de imagem
       * escolhida por um atacante é um sinal de "esta página foi aberta" saindo
       * do painel. Sem SUPABASE_URL definida, o item simplesmente não entra.
       */
      ['img-src', "'self'", 'data:', 'blob:', storageOrigin()].filter(Boolean).join(' '),
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join('; '),
  );
  return response;
}
