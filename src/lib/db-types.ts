/**
 * Tipos das linhas do Postgres (espelham supabase/migrations/0001_init.sql).
 *
 * Escritos à mão em vez de gerados pela CLI da Supabase para não amarrar o
 * build a uma ferramenta externa. Ao alterar uma migration, atualize aqui —
 * é o único ponto de sincronização manual do projeto.
 */
import type { Specialty } from '@/data/specialties';

export type DoctorId = 'dr-alexandre' | 'dra-bruna' | 'dr-igor';

export type PostStatus = 'draft' | 'published' | 'archived';

export interface AdminUserRow {
  id: string;
  doctor_id: DoctorId;
  email: string;
  name: string;
  password_hash: string;
  active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminSessionRow {
  id: string;
  user_id: string;
  /** bytea: o cliente devolve como string hex no formato `\x...`. */
  token_hash: string;
  user_agent: string | null;
  ip: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface PostRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  body_md: string;
  specialty: Specialty;
  author_id: DoctorId;
  tags: string[];
  cover_path: string | null;
  cover_alt: string;
  status: PostStatus;
  published_at: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'password.change'
  | 'password.reset'
  | 'user.activate'
  | 'user.deactivate'
  | 'session.revoke'
  | 'post.create'
  | 'post.update'
  | 'post.publish'
  | 'post.unpublish'
  | 'post.delete';

export interface AuditLogRow {
  id: number;
  user_id: string | null;
  action: AuditAction;
  target: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}

/**
 * Usuário exposto à aplicação — o `password_hash` NUNCA sai de src/lib/auth.
 * É este o objeto que chega em `Astro.locals.user`.
 */
export interface SessionUser {
  id: string;
  doctorId: DoctorId;
  email: string;
  name: string;
  mustChangePassword: boolean;
  sessionId: string;
}
