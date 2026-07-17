import type { APIRoute } from 'astro';
import { SESSION_COOKIE } from '@/lib/auth';

export const prerender = false;

/** Encerra a sessão da área restrita e volta para o login. */
export const POST: APIRoute = ({ cookies, redirect }) => {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/admin/login');
};
