import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

/**
 * Protege a área restrita: qualquer rota sob /admin exige sessão válida,
 * exceto a própria tela de login. Usuário já logado que abrir /admin/login
 * é levado direto ao painel.
 *
 * As páginas públicas (prerenderizadas) passam direto — o middleware só
 * decide algo para caminhos /admin, que são todos server-rendered.
 */
export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;

  if (!pathname.startsWith('/admin')) return next();

  const isLoginPage = pathname === '/admin/login' || pathname === '/admin/login/';
  const isAuthenticated = verifySessionToken(context.cookies.get(SESSION_COOKIE)?.value);

  if (!isAuthenticated && !isLoginPage) return context.redirect('/admin/login');
  if (isAuthenticated && isLoginPage) return context.redirect('/admin');

  return next();
});
