-- ═════════════════════════════════════════════════════════════════════════════
-- Clínica RIM — schema inicial do backend do blog
--
-- Como aplicar: Supabase > SQL Editor > cole este arquivo inteiro > Run.
-- É idempotente o bastante para rodar uma vez; não rode duas.
--
-- Convenções seguidas (skill supabase-postgres-best-practices):
--   · identificadores minúsculos com underscore   (schema-lowercase-identifiers)
--   · chave primária em toda tabela               (schema-primary-keys)
--   · índice em toda chave estrangeira            (schema-foreign-key-indexes)
--   · regra de negócio como constraint no banco   (schema-constraints)
--   · timestamptz, nunca timestamp                (schema-data-types)
--   · índices parciais para as queries quentes    (query-partial-indexes)
--   · RLS ligada em tudo                          (security-rls-basics)
-- ═════════════════════════════════════════════════════════════════════════════

create extension if not exists citext;

-- ─────────────────────────────────────────────────────────────────────────────
-- Gatilho compartilhado: mantém updated_at correto sem depender da aplicação.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- admin_users — os 3 médicos. Todos com o mesmo poder (admin pleno).
-- Não há tabela de papéis: o requisito é explícito de que os três podem tudo.
-- ═════════════════════════════════════════════════════════════════════════════
create table admin_users (
  id                   uuid        primary key default gen_random_uuid(),

  -- Liga ao médico em src/data/doctors.ts. É essa chave que vira o autor do
  -- post, então bio/CRM/foto continuam versionados no código (conteúdo verbatim).
  doctor_id            text        not null unique
                                   check (doctor_id in ('dr-alexandre', 'dra-bruna', 'dr-igor')),

  -- citext = comparação sem diferenciar maiúsculas. "Bruna@x.com" e "bruna@x.com"
  -- são o mesmo login, e o unique impede cadastrar os dois.
  email                citext      not null unique check (email like '%@%.%'),
  name                 text        not null check (char_length(name) between 2 and 120),

  -- Formato "scrypt$<N>$<r>$<p>$<salt_b64>$<hash_b64>". Os parâmetros ficam
  -- gravados junto para que endurecê-los no futuro não invalide as senhas atuais.
  password_hash        text        not null,

  active               boolean     not null default true,
  -- Senha inicial é gerada pelo seed; o médico é obrigado a trocar no 1º acesso.
  must_change_password boolean     not null default true,

  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger admin_users_updated_at
  before update on admin_users
  for each row execute function set_updated_at();


-- ═════════════════════════════════════════════════════════════════════════════
-- admin_sessions — sessões revogáveis.
--
-- O modelo antigo usava token auto-contido assinado por HMAC: impossível
-- derrubar UMA sessão sem trocar o segredo e derrubar todo mundo junto.
-- Aqui o cookie carrega um token opaco aleatório e o banco guarda só o
-- SHA-256 dele — vazamento do dump não dá acesso a nenhuma sessão viva.
-- ═════════════════════════════════════════════════════════════════════════════
create table admin_sessions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references admin_users(id) on delete cascade,
  -- SHA-256 em hex. `text` e não `bytea` de propósito: bytea sobre PostgREST
  -- exige encoding `\x...` nos dois sentidos e não ganha nada aqui.
  token_hash text        not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  user_agent text,
  ip         inet,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index admin_sessions_user_id_idx on admin_sessions (user_id);
-- Parcial: a limpeza periódica e a listagem "minhas sessões ativas" só olham
-- as não revogadas, então o índice não carrega o lixo histórico.
create index admin_sessions_active_idx on admin_sessions (expires_at)
  where revoked_at is null;


-- ═════════════════════════════════════════════════════════════════════════════
-- posts — os artigos do blog.
-- ═════════════════════════════════════════════════════════════════════════════
create type post_status as enum ('draft', 'published', 'archived');

create table posts (
  id           uuid        primary key default gen_random_uuid(),

  slug         text        not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text        not null check (char_length(title) between 8 and 140),
  description  text        not null check (char_length(description) between 20 and 300),
  body_md      text        not null check (char_length(body_md) >= 50),

  -- Espelha SPECIALTIES em src/data/specialties.ts.
  specialty    text        not null
                           check (specialty in ('Nefrologia', 'Endocrinologia', 'Urologia')),
  -- Espelha os ids de src/data/doctors.ts. Autor do artigo — não confundir com
  -- created_by, que é quem operou o painel.
  author_id    text        not null
                           check (author_id in ('dr-alexandre', 'dra-bruna', 'dr-igor')),

  tags         text[]      not null default '{}',

  -- Caminho no bucket 'blog-covers'. NULL = usa a arte padrão da especialidade.
  cover_path   text,
  cover_alt    text        not null default '',

  status       post_status not null default 'draft',
  published_at timestamptz,

  created_by   uuid        not null references admin_users(id),
  updated_by   uuid        references admin_users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- "Publicado sem data de publicação" é um estado impossível. O banco recusa,
  -- em vez de deixar a aplicação gerar um post que ordena errado na listagem.
  constraint posts_published_needs_date
    check (status <> 'published' or published_at is not null),

  -- Capa enviada exige texto alternativo — acessibilidade não é opcional, e o
  -- schema da Content Layer (coverAlt: z.string()) já exigia isso no build.
  constraint posts_cover_needs_alt
    check (cover_path is null or char_length(cover_alt) > 0)
);

create trigger posts_updated_at
  before update on posts
  for each row execute function set_updated_at();

-- Query principal do blog: listagem por data. Parcial porque rascunho e
-- arquivado nunca aparecem aqui.
create index posts_published_idx on posts (published_at desc)
  where status = 'published';

-- Página /blog/especialidade/[specialty].
create index posts_specialty_idx on posts (specialty, published_at desc)
  where status = 'published';

-- Painel: listagem por status, e busca por autor.
create index posts_admin_list_idx on posts (status, updated_at desc);
create index posts_author_idx on posts (author_id);

create index posts_tags_idx on posts using gin (tags);

-- Índices de FK (sem eles, deletar um admin_user faz sequential scan em posts).
create index posts_created_by_idx on posts (created_by);
create index posts_updated_by_idx on posts (updated_by);


-- ═════════════════════════════════════════════════════════════════════════════
-- post_revisions — histórico. Substitui o `git log` que o desenho antigo dava
-- de graça, e é mais útil: o médico consegue ver e restaurar do próprio painel.
-- Grava o estado ANTERIOR a cada alteração.
-- ═════════════════════════════════════════════════════════════════════════════
create table post_revisions (
  id         bigint      generated always as identity primary key,
  post_id    uuid        not null references posts(id) on delete cascade,
  snapshot   jsonb       not null,
  changed_by uuid        references admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index post_revisions_post_idx on post_revisions (post_id, created_at desc);
create index post_revisions_changed_by_idx on post_revisions (changed_by);


-- ═════════════════════════════════════════════════════════════════════════════
-- admin_audit_log — quem fez o quê. Serve a três propósitos:
--   1. rastreabilidade (quem publicou/excluiu);
--   2. base do rate limit de login (conta 'login_failed' recentes);
--   3. diagnóstico quando algo der errado em produção.
-- ═════════════════════════════════════════════════════════════════════════════
create table admin_audit_log (
  id         bigint      generated always as identity primary key,
  -- on delete set null: apagar um usuário não pode apagar a trilha de auditoria.
  user_id    uuid        references admin_users(id) on delete set null,
  -- 'login' | 'login_failed' | 'logout' | 'password.change' | 'password.reset'
  -- | 'user.deactivate' | 'session.revoke' | 'post.create' | 'post.update'
  -- | 'post.publish' | 'post.unpublish' | 'post.delete'
  action     text        not null,
  target     text,
  metadata   jsonb       not null default '{}',
  ip         inet,
  created_at timestamptz not null default now()
);

create index admin_audit_log_recent_idx on admin_audit_log (created_at desc);
create index admin_audit_log_user_idx on admin_audit_log (user_id, created_at desc);

-- Parcial e composto: o rate limit pergunta "quantas falhas deste IP nos
-- últimos 15 min?". Sem o `where`, o índice cresceria com todo o log de
-- atividade normal e a consulta ficaria cara justamente sob ataque.
create index admin_audit_log_failed_ip_idx on admin_audit_log (ip, created_at desc)
  where action = 'login_failed';
create index admin_audit_log_failed_target_idx on admin_audit_log (target, created_at desc)
  where action = 'login_failed';


-- ═════════════════════════════════════════════════════════════════════════════
-- RLS — defesa em profundidade.
--
-- Todo acesso a estas tabelas é server-side, com a service_role key, que ignora
-- RLS por definição. Ligamos RLS mesmo assim e NÃO criamos policy nenhuma:
-- o efeito é que a chave `anon` (a pública, que pode aparecer no navegador)
-- não lê nem escreve absolutamente nada. Se ela vazar, não há dano.
--
-- ⚠️ Consequência: nunca consulte estas tabelas de um componente React.
-- ═════════════════════════════════════════════════════════════════════════════
alter table admin_users     enable row level security;
alter table admin_sessions  enable row level security;
alter table posts           enable row level security;
alter table post_revisions  enable row level security;
alter table admin_audit_log enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
