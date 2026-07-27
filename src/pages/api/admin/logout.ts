import type { APIRoute } from 'astro';
import { SESSION_COOKIE, audit, revokeSession } from '@/lib/auth';
import { clientIp } from '@/lib/utils/request';

export const prerender = false;

/**
 * Encerra a sessão.
 *
 * Apagar o cookie não basta: o token continuaria válido no banco e voltaria a
 * funcionar se alguém o tivesse copiado. Revogamos a sessão do lado do
 * servidor primeiro — é isso que torna o logout real.
 */
export const POST: APIRoute = async ({ cookies, redirect, locals, request }) => {
  const user = locals.user;

  if (user) {
    try {
      await revokeSession(user.sessionId);
    } catch (error) {
      // Mesmo falhando a revogação, o cookie sai: o usuário perde o acesso
      // neste navegador e a sessão expira sozinha em no máximo 12h.
      console.error('[logout] falha ao revogar sessão:', (error as Error).message);
    }
    await audit({ action: 'logout', userId: user.id, ip: clientIp(request) });
  }

  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/admin/login');
};
