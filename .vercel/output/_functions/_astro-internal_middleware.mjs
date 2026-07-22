import { e as defineMiddleware, s as sequence } from './chunks/render-context_C1SnETNC.mjs';
import { v as verifySessionToken, S as SESSION_COOKIE } from './chunks/auth_toOKJSnr.mjs';
import 'es-module-lexer';
import './chunks/astro-designed-error-pages_DRtmy5yl.mjs';
import 'piccolore';
import './chunks/astro/server_BUPcWb2m.mjs';
import 'clsx';

const onRequest$1 = defineMiddleware((context, next) => {
  const { pathname } = context.url;
  if (!pathname.startsWith("/admin")) return next();
  const isLoginPage = pathname === "/admin/login" || pathname === "/admin/login/";
  const isAuthenticated = verifySessionToken(context.cookies.get(SESSION_COOKIE)?.value);
  if (!isAuthenticated && !isLoginPage) return context.redirect("/admin/login");
  if (isAuthenticated && isLoginPage) return context.redirect("/admin");
  return next();
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
