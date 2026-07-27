# Plano de execução — Backend do blog da Clínica RIM

Documento de planejamento. Nada foi implementado ainda.

**Objetivo declarado:**

1. O blog funcionando no domínio próprio da clínica.
2. Os 3 médicos com login e senha individuais.
3. Os 3 perfis com poder total de admin dentro da área do blog.

---

## 1. Diagnóstico — o que existe hoje

### Site público

Astro 5 em modo estático (SSG), adapter Vercel, Tailwind v4, ilhas React pontuais.
Estrutura sólida e bem comentada:

| Área | Estado |
|---|---|
| Home (`src/pages/index.astro`) | Completa — Hero, Sobre, Corpo Clínico, Sintomas, FAQ, Reviews, Localização, Contato |
| Blog | `/blog`, `/blog/[page]`, `/blog/[slug]`, `/blog/especialidade/[specialty]` — funcionando |
| SEO | `BaseHead`, `JsonLd`, sitemap, RSS, `noindex` no admin, robots.txt |
| Formulário de contato | Abre WhatsApp — **não usa backend** (ótimo: zero dado sensível trafegando/armazenado) |
| Conteúdo dos médicos | `src/data/doctors.ts` — fonte única, usada no site e como autor dos posts |
| Posts | 2 arquivos markdown em `src/content/blog/` |

O site público **não precisa de backend**. Isso é uma vantagem grande e o plano preserva isso.

### Área administrativa (`/admin`)

| Componente | Arquivo | Estado |
|---|---|---|
| Autenticação | [src/lib/auth.ts](../src/lib/auth.ts) | Usuário **único**, usuário/senha em texto puro em variável de ambiente, cookie HMAC de 8h |
| Proteção de rota | [src/middleware.ts](../src/middleware.ts) | Protege `/admin/*` |
| CRUD de posts | [src/lib/admin/posts.ts](../src/lib/admin/posts.ts) | Criar e excluir. **Não edita.** |
| Armazenamento | [src/lib/admin/github.ts](../src/lib/admin/github.ts) | Commit na API do GitHub → dispara build da Vercel (~1-2 min) |
| Telas | `src/pages/admin/{index,login,novo}.astro` | Lista, login, editor de novo artigo |

O desenho atual é inteligente para um único autor técnico. Mas ele bate de frente com os
três requisitos. Levantamento honesto dos problemas:

**Bloqueadores dos requisitos**

- **B1 — Um único login compartilhado.** `ADMIN_USER` / `ADMIN_PASSWORD` são um par só.
  Não há como dar credencial individual aos 3 médicos, nem saber quem publicou o quê.
- **B2 — Senha em texto puro na variável de ambiente.** Qualquer pessoa com acesso ao painel
  da Vercel lê a senha dos médicos. Se um deles reusar a senha em outro lugar, é um vazamento real.
- **B3 — Trocar senha exige redeploy.** O médico não consegue trocar a própria senha sozinho.
- **B4 — Não existe revogação de sessão.** O token é auto-contido; se um notebook for roubado,
  a única saída é trocar o `AUTH_SECRET`, o que derruba os três ao mesmo tempo.
- **B5 — Sem limite de tentativas de login.** Força bruta contra `/admin/login` é viável hoje.

**Limitações funcionais**

- **L1 — Não dá para editar um artigo publicado.** Só criar e excluir. Para um médico que
  quer corrigir uma frase, isso significa apagar e reescrever tudo. É a maior dor de uso do painel.
- **L2 — Não dá para pré-visualizar um rascunho.** Posts com `draft: true` são excluídos do build,
  então não existe URL para conferir como o artigo ficou antes de publicar.
- **L3 — `listMarkdown` faz 1 requisição por post** ([github.ts:171](../src/lib/admin/github.ts#L171)).
  Com 40 artigos, abrir o painel dispara 41 chamadas à API do GitHub. Vai ficar lento e bater
  no rate limit.
- **L4 — O token do GitHub expira** (fine-grained token, máximo 1 ano). Quando vencer, o painel
  para de publicar sem aviso prévio.
- **L5 — Escrever Markdown puro** é fricção para autor não técnico.

**Higiene de repositório**

- **H1 — `.vercel/` está versionado** (239 arquivos de build commitados, e o `git status`
  atual mostra dezenas de chunks entrando e saindo a cada build). Não está no `.gitignore`.
  Além de poluir o histórico, é um vetor de vazamento: se alguém rodar `vercel build` com um
  `.env` real, o artefato compilado vai para o repositório. Hoje já dá para ver a senha de
  desenvolvimento `rim2026` dentro de `.vercel/output/_functions/chunks/auth_*.mjs`.
- **H2 — O domínio ainda é placeholder.** `astro.config.mjs` aponta para
  `https://www.clinicarim.com.br` com um `TODO` de confirmação. Esse valor alimenta sitemap,
  RSS e as URLs absolutas de Open Graph — se estiver errado no ar, o SEO nasce quebrado.
- **H3 — O middleware protege `/admin/*` mas não `/api/admin/*`.** Hoje só existe o logout ali
  (inofensivo), mas qualquer endpoint futuro nasceria desprotegido.

---

## 2. Skills disponíveis que se aplicam

Varri `D:\Cursos\skills\~\antigravity-skills\skills`. Das 58 skills, as relevantes para backend aqui:

| Skill | Uso neste projeto |
|---|---|
| **`supabase-postgres-best-practices`** | A única skill de backend/banco do conjunto. 33 regras de Postgres da Supabase (índices, RLS, pooling de conexão em serverless, paginação, tipos). É a base técnica da recomendação abaixo. |
| `test-driven-development` | Auth e permissões são exatamente o tipo de código que deve nascer com teste. |
| `systematic-debugging` | Para a fase de integração com Vercel/DNS. |
| `verification-before-completion` | Checklist antes de considerar cada fase pronta. |
| `writing-plans` / `executing-plans` | Formato deste documento e execução por fases. |
| `react-best-practices` | Para o editor de artigos (ilha React). |
| `webapp-testing` | Teste end-to-end do fluxo de login → publicar → ver no blog. |
| `finishing-a-development-branch` | Fechamento de cada fase. |

Não há skill de autenticação, de Astro, nem de Vercel no conjunto — essa parte é implementação nossa.

**Sobre o `supabase-postgres-best-practices`:** as regras que mais impactam o desenho aqui são
`conn-pooling` (função serverless não pode abrir conexão TCP direta com o Postgres — precisa de
pooler ou cliente HTTP), `security-rls-basics` (RLS ligado em tudo, mesmo acessando por
service role), `schema-foreign-key-indexes` (índice em toda FK) e `data-pagination`
(paginação por keyset, não `OFFSET`).

---

## 3. Decisão de arquitetura

### O que os requisitos realmente implicam

O requisito 3 — "os 3 perfis podem fazer tudo como admin" — **simplifica bastante**: não existe
matriz de permissões, não existe fluxo de aprovação, não existe papel de revisor. Um papel só:
admin. Isso elimina a parte mais cara de um CMS multiusuário.

O que sobra de essencial: **identidade individual, senha com hash, sessão revogável, e registro
de quem fez o quê.** Isso exige armazenamento persistente. Não tem como fazer bem só com
variável de ambiente.

### Recomendação: Supabase como backend, site público continua estático

```
┌─────────────────────────────────────────────────────────────────┐
│  NAVEGADOR                                                       │
└────────────┬──────────────────────────────┬─────────────────────┘
             │ site público (HTML estático) │ /admin (SSR)
             ▼                              ▼
┌────────────────────────┐      ┌───────────────────────────────┐
│  Vercel — Edge/CDN     │      │  Vercel — Função serverless   │
│  páginas pré-renderiz. │      │  login, painel, editor        │
└────────────┬───────────┘      └───────────┬───────────────────┘
             │ build                        │ supabase-js (HTTPS)
             ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SUPABASE                                                        │
│  Postgres: admin_users · admin_sessions · posts · audit_log      │
│  Storage:  blog-covers (imagens de capa)                         │
└─────────────────────────────────────────────────────────────────┘
             ▲                              │
             └── Content Layer loader ──────┘  publicar → deploy hook
```

**Como funciona na prática**

1. O médico faz login em `/admin` com e-mail e senha próprios (validado contra hash no Postgres).
2. Escreve/edita o artigo. Salva → grava na tabela `posts` como rascunho. **Instantâneo.**
3. Pré-visualiza em `/admin/preview/<id>`, uma rota SSR que lê direto do banco. **Instantâneo,
   sem build.**
4. Clica em "Publicar" → o post vira `status = 'published'` e o painel dispara um
   *deploy hook* da Vercel.
5. O build roda um **loader customizado da Content Layer do Astro 5** que busca os posts
   publicados no Supabase e os injeta na coleção `blog`. **Todas as páginas atuais do blog,
   o RSS e o sitemap continuam funcionando sem alteração.**
6. O site no ar continua 100% estático — mesma performance, mesmo SEO, mesmo custo de hoje.

**Por que este desenho, e não outro**

| Ganho | Como |
|---|---|
| Resolve B1–B5 | Tabela de usuários com hash scrypt, tabela de sessões revogáveis, log de auditoria, rate limit por tentativa |
| Resolve L1 (editar) | `UPDATE` numa linha — trivial, ao contrário de reescrever um commit |
| Resolve L2 (preview) | Rota SSR lendo o banco: rascunho visível na hora |
| Resolve L3 (N+1) | Uma query indexada em vez de 41 chamadas HTTP |
| Resolve L4 (token) | Sai o token do GitHub do caminho crítico |
| Mantém o site estático | Content Layer loader roda no build; o público nunca toca o banco |
| Mantém a otimização de imagem | Capas no Storage + `image.remotePatterns` no Astro |
| Mantém `src/data/doctors.ts` | O post referencia `author_id`; a bio/CRM/foto seguem versionadas no código, que é onde devem estar (conteúdo verbatim, revisado) |
| Falha de forma segura | Se o Supabase cair durante um build, o build falha e a Vercel **mantém o deploy anterior no ar**. O site nunca fica fora do ar por causa do banco. |

**O que se perde**, e por que aceito perder:

- *Versionamento git dos artigos.* Compensado por histórico de revisões no próprio banco
  (tabela `post_revisions`, incluída no plano) — que aliás é mais útil para o médico do que
  um `git log` que ele nunca vai abrir.
- *Uma dependência externa a mais.* Mitigada pelo modo de falha acima e pelo backup diário.

**Por que Supabase e não Neon / Vercel Postgres / Turso:** precisamos de Postgres **e** de
armazenamento de imagens. Supabase entrega os dois no mesmo projeto, com um cliente HTTP
(`supabase-js`) que não sofre com esgotamento de pool em serverless — que é o problema clássico
de Postgres + Vercel (regra `conn-pooling` da skill). E é a stack coberta pela única skill de
backend que temos.

**Atenção ao plano gratuito:** projeto Supabase no free tier é **pausado após 7 dias sem
atividade**. Uma clínica que publica uma vez por mês cairia nisso. Mitigação incluída na Fase 1:
um Vercel Cron diário batendo num endpoint de health que faz uma query trivial. Se preferirem
não depender disso, o plano Pro custa US$ 25/mês e remove a pausa + dá backup diário automático.

### Alternativa considerada: manter git-as-CMS, só trocar a autenticação

Colocar os 3 usuários em variável de ambiente (JSON com hashes scrypt) e manter o markdown +
commit no GitHub.

- **Custo:** ~1,5 dia em vez de ~7.
- **Resolve:** B1, B2, parcialmente B5.
- **Não resolve:** B3 (troca de senha exige redeploy), B4 (sem revogação), L1 (sem edição),
  L2 (sem preview), L3, L4.

**Quando escolher esta:** se a prioridade for colocar no ar em uma semana e os médicos aceitarem
que "editar" significa apagar e republicar. É uma escolha defensável, mas L1 vai gerar
reclamação — é a primeira coisa que um autor tenta fazer.

**Meu voto:** Supabase. O delta é ~5 dias de trabalho e entrega um painel que os médicos
conseguem usar sozinhos por anos, sem chamar ninguém para trocar uma senha ou corrigir um typo.

---

## 4. Modelo de dados

Escrito seguindo as regras da skill: identificadores minúsculos (`schema-lowercase-identifiers`),
chave primária em tudo (`schema-primary-keys`), índice em toda FK (`schema-foreign-key-indexes`),
constraints no banco e não só na aplicação (`schema-constraints`), `timestamptz` e não `timestamp`
(`schema-data-types`).

```sql
create extension if not exists citext;

-- ─── Usuários do painel: os 3 médicos ────────────────────────────────────────
create table admin_users (
  id                   uuid primary key default gen_random_uuid(),
  -- Liga ao médico em src/data/doctors.ts ('dr-alexandre' | 'dra-bruna' | 'dr-igor').
  doctor_id            text        not null unique,
  email                citext      not null unique,
  name                 text        not null,
  -- scrypt(N=16384, r=8, p=1) — formato "scrypt$<salt_b64>$<hash_b64>".
  password_hash        text        not null,
  active               boolean     not null default true,
  must_change_password boolean     not null default true,
  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ─── Sessões: revogáveis, ao contrário do token auto-contido de hoje ─────────
create table admin_sessions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references admin_users(id) on delete cascade,
  -- Guardamos só o SHA-256 do token. Vazamento do banco não dá acesso a sessão.
  token_hash bytea       not null unique,
  user_agent text,
  ip         inet,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on admin_sessions (user_id);
create index on admin_sessions (expires_at) where revoked_at is null;

-- ─── Artigos ─────────────────────────────────────────────────────────────────
create type post_status as enum ('draft', 'published', 'archived');

create table posts (
  id           uuid        primary key default gen_random_uuid(),
  slug         text        not null unique check (slug ~ '^[a-z0-9-]+$'),
  title        text        not null check (char_length(title) between 8 and 140),
  description  text        not null check (char_length(description) between 20 and 300),
  body_md      text        not null check (char_length(body_md) >= 50),
  specialty    text        not null check (specialty in ('Nefrologia','Endocrinologia','Urologia')),
  author_id    text        not null,   -- id em src/data/doctors.ts
  tags         text[]      not null default '{}',
  cover_path   text,                   -- caminho no Storage; null = arte padrão da especialidade
  cover_alt    text        not null default '',
  status       post_status not null default 'draft',
  published_at timestamptz,
  created_by   uuid        not null references admin_users(id),
  updated_by   uuid        references admin_users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Publicado sem data é estado inválido: o banco recusa.
  constraint published_needs_date check (status <> 'published' or published_at is not null)
);

-- Índice da consulta principal do blog (listagem por data).
create index on posts (published_at desc) where status = 'published';
-- Índice parcial da página por especialidade (query-partial-indexes).
create index on posts (specialty, published_at desc) where status = 'published';
create index on posts using gin (tags);
create index on posts (created_by);   -- FK
create index on posts (updated_by);   -- FK

-- ─── Histórico de revisões: substitui o git log, e é mais útil ao autor ──────
create table post_revisions (
  id         bigint generated always as identity primary key,
  post_id    uuid        not null references posts(id) on delete cascade,
  snapshot   jsonb       not null,     -- estado completo do post antes da alteração
  changed_by uuid        references admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on post_revisions (post_id, created_at desc);
create index on post_revisions (changed_by);

-- ─── Auditoria: quem fez o quê, e base do rate limit de login ───────────────
create table admin_audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid references admin_users(id) on delete set null,
  action     text        not null,   -- 'login' | 'login_failed' | 'post.publish' | ...
  target     text,
  metadata   jsonb       not null default '{}',
  ip         inet,
  created_at timestamptz not null default now()
);
create index on admin_audit_log (created_at desc);
create index on admin_audit_log (user_id, created_at desc);
-- Índice parcial que serve o rate limit sem varrer a tabela inteira.
create index on admin_audit_log (ip, created_at desc) where action = 'login_failed';

-- ─── RLS: defesa em profundidade ─────────────────────────────────────────────
-- Todo acesso é server-side com a service_role key, que ignora RLS. Ligamos RLS
-- assim mesmo e não criamos policy nenhuma: se a chave anon vazar algum dia,
-- ela não lê absolutamente nada. (security-rls-basics)
alter table admin_users     enable row level security;
alter table admin_sessions  enable row level security;
alter table posts           enable row level security;
alter table post_revisions  enable row level security;
alter table admin_audit_log enable row level security;

revoke all on all tables in schema public from anon, authenticated;
```

**Regra de ouro de segurança do desenho:** a `SUPABASE_SERVICE_ROLE_KEY` **nunca** pode aparecer
num componente React nem em qualquer código que chegue ao navegador. Ela só é lida dentro de
`src/lib/` a partir de rotas com `prerender = false`. Isso vira item de checklist e de code review.

---

## 5. Fases de execução

Estimativa em dias de trabalho focado.

### Fase 0 — Domínio e higiene · ~0,5 dia · **pré-requisito de tudo**

Esta fase entrega o requisito 1 e é independente da decisão de backend. Pode começar já.

1. **Tirar o build do repositório.** Adicionar `.vercel/` ao `.gitignore` e rodar
   `git rm -r --cached .vercel`. Resolve H1.
2. **Fixar o domínio final** em `astro.config.mjs` (`site`), removendo o `TODO`. Resolve H2.
3. **Registrar/apontar o domínio.** Vercel → Settings → Domains: adicionar apex e `www`.
   No registrador (Registro.br, se `.com.br`): apontar os DNS conforme a Vercel indicar.
   Definir qual é o canônico e redirecionar o outro (recomendo `www` como canônico, que é o
   que já está no config).
4. **Aguardar propagação de DNS + emissão do certificado** (minutos a algumas horas).
5. **Conferir no domínio real:** `/sitemap-index.xml`, `/rss.xml`, `/robots.txt` e as URLs
   absolutas de Open Graph. Todos precisam apontar para o domínio novo, não para `.vercel.app`.
6. **Cadastrar o site no Google Search Console** e submeter o sitemap.
7. Corrigir H3: fazer o middleware cobrir `/api/admin/*` também.

**Pronto quando:** o site abre em `https://<dominio>` com cadeado, o sitemap lista as URLs com
o domínio correto, e `git status` fica limpo depois de um build.

> ⚠️ **Ponto sobre a Vercel:** o plano Hobby proíbe uso comercial nos termos de serviço. Um site
> de clínica é uso comercial. Para ficar em conformidade, o projeto precisa estar num plano
> **Pro (US$ 20/mês)**. Vale decidir isso agora, junto do domínio.

---

### Fase 1 — Provisionar o Supabase · ~0,5 dia

1. Criar projeto na região **South America (São Paulo)** — menor latência para os médicos.
2. Rodar as migrations da seção 4 (arquivos versionados em `supabase/migrations/`).
3. Criar o bucket de Storage `blog-covers`, leitura pública, escrita só por service role.
4. Cadastrar na Vercel (escopo Production **e** Preview):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_DEPLOY_HOOK_URL`.
5. Criar o deploy hook na Vercel (Settings → Git → Deploy Hooks) para a branch de produção.
6. **Keep-alive:** endpoint `/api/health` fazendo um `select 1`, e um Vercel Cron diário
   apontando para ele. Evita a pausa do free tier.
7. Instalar `@supabase/supabase-js`.

**Pronto quando:** as tabelas existem, `/api/health` responde 200 em produção, e o cron aparece
como agendado no painel da Vercel.

---

### Fase 2 — Autenticação multiusuário · ~1,5 dia · **entrega os requisitos 2 e 3**

Reescrita de [src/lib/auth.ts](../src/lib/auth.ts). O que muda:

| Hoje | Depois |
|---|---|
| 1 usuário em env var | 3 usuários na tabela `admin_users` |
| Senha em texto puro | Hash scrypt (`node:crypto`, já disponível — sem dependência nova) |
| Token auto-contido HMAC | Token opaco aleatório de 256 bits; o SHA-256 dele fica em `admin_sessions` |
| Sem revogação | `revoked_at` — dá para derrubar uma sessão específica |
| Sem rate limit | 5 falhas por IP+e-mail em 15 min → bloqueio temporário |
| Sem identidade no post | `Astro.locals.user` disponível em toda rota `/admin` |

**Arquivos**

- `src/lib/db.ts` — cliente Supabase server-only (com guarda que estoura se importado no cliente).
- `src/lib/auth/password.ts` — `hashPassword` / `verifyPassword` (scrypt, comparação em tempo constante).
- `src/lib/auth/session.ts` — `createSession` / `getSession` / `revokeSession` / `revokeAllForUser`.
- `src/lib/auth/users.ts` — `authenticate`, `changePassword`, `resetPassword`, `setActive`.
- `src/lib/auth/rate-limit.ts` — contagem em `admin_audit_log`.
- `src/middleware.ts` — cobre `/admin/*` **e** `/api/admin/*`; popula `Astro.locals.user`;
  força redirecionamento para troca de senha quando `must_change_password` é true.
- `src/env.d.ts` — declarar `App.Locals.user`.
- `scripts/seed-admins.ts` — cria os 3 médicos com senha inicial aleatória, impressa uma vez
  no terminal, com `must_change_password = true`.

**Telas novas**

- `/admin/login` — passa a pedir e-mail + senha. Mensagem de erro genérica
  ("e-mail ou senha inválidos") para não revelar quais e-mails existem.
- `/admin/conta` — trocar a própria senha; ver e encerrar as próprias sessões ativas.
- `/admin/usuarios` — como os 3 são admin plenos: listar os usuários, **redefinir a senha de
  outro médico**, desativar acesso e revogar sessões. Isso elimina a necessidade de e-mail
  transacional para recuperação de senha — se um médico esquecer a senha, outro redefine em
  10 segundos.

**Política de senha:** mínimo 12 caracteres, bloqueio das senhas mais comuns, sem exigência de
símbolo (regra que só gera `Senha@123`). Sessão de 12h com renovação deslizante.

**Testes** (usando a skill `test-driven-development`): hash/verify, expiração, revogação,
rate limit, e um teste end-to-end de login → publicar → logout.

**Pronto quando:** os 3 médicos logam com credenciais próprias, trocam a senha na primeira
entrada, um consegue redefinir a senha do outro, e uma sessão revogada perde o acesso na
requisição seguinte.

---

### Fase 3 — Conteúdo no Postgres · ~2,5 dias

1. **Repositório de posts** — reescrever [src/lib/admin/posts.ts](../src/lib/admin/posts.ts)
   sobre `supabase-js`: `list` (paginação keyset, conforme `data-pagination`), `getById`,
   `create`, `update`, `publish`, `unpublish`, `remove`, `listRevisions`, `restoreRevision`.
2. **Upload de capa** — para o bucket `blog-covers`, com redimensionamento no cliente antes
   do envio (economiza banda e evita o limite de 4,5 MB do corpo de requisição da Vercel).
3. **Loader da Content Layer** — `src/lib/content/posts-loader.ts`, um `Loader` do Astro 5 que
   busca os posts publicados no build. `src/content.config.ts` passa a usar esse loader no lugar
   do `glob()`. O `cover` vira URL do Storage; adicionar `image.remotePatterns` no
   `astro.config.mjs` para o Astro continuar otimizando as capas.
   **As páginas do blog, o RSS e o sitemap não mudam uma linha.**
4. **Migração dos 2 posts existentes** — script que lê o frontmatter dos markdown, sobe as capas
   para o Storage e insere no banco. Os arquivos originais ficam no repositório como backup
   até a validação, depois saem.
5. **Deploy hook** — publicar/despublicar/excluir dispara o rebuild. Com *debounce*: se o médico
   publicar 3 artigos em sequência, dispara um build só.
6. **Preview** — `/admin/preview/[id]`, SSR, `noindex`, exige sessão, renderiza o markdown com
   o mesmo layout do blog. Resolve L2.
7. Remover `src/lib/admin/github.ts` e as variáveis `GITHUB_*` do `.env.example`.

**Pronto quando:** os 2 posts atuais aparecem idênticos no site depois da migração, um post
novo criado pelo painel entra no ar após o build, e um rascunho é visível no preview sem build.

---

### Fase 4 — Painel utilizável por médico · ~2 dias

Aqui é onde o painel deixa de ser "funciona" e vira "eles usam sozinhos".

1. **Editar artigo** (`/admin/editar/[id]`) — o item mais importante da lista inteira. Resolve L1.
2. **Editor Markdown com pré-visualização lado a lado** e barra de ferramentas
   (negrito, itálico, título, lista, link). Ilha React, usando `marked` + `DOMPurify`.
   *Alternativa: editor WYSIWYG (TipTap) convertendo para Markdown — mais confortável para
   quem nunca viu Markdown, mais código para manter. Decisão sua (ver seção 9).*
3. **Salvamento automático de rascunho** a cada 30s — ninguém perde um artigo por fechar a aba.
4. **Lista com busca, filtro por status/especialidade/autor** e paginação keyset.
5. **Contador de caracteres com alvo de SEO** no título e na descrição.
6. **Histórico de revisões** — ver versões anteriores e restaurar.
7. **Indicador de build** — depois de publicar, mostrar "publicando… (~1-2 min)" com
   atualização de status, para o médico não achar que quebrou.

**Pronto quando:** um dos médicos consegue, sem ajuda, escrever, revisar, publicar e depois
corrigir um artigo.

---

### Fase 5 — Segurança e operação · ~1 dia

1. **Tela de auditoria** (`/admin/atividade`) — logins, publicações, exclusões, com autor e data.
2. **Cabeçalhos de segurança** no `/admin` via middleware: `Content-Security-Policy`,
   `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`.
3. **Backup** — no plano Pro do Supabase, backup diário é automático. No free tier, um cron
   semanal fazendo `pg_dump` para o Storage.
4. **Rotação de segredo documentada** — passo a passo para trocar a service role key.
5. **Limpeza automática** de sessões expiradas e de logs de auditoria com mais de 12 meses
   (`pg_cron` no Supabase).
6. **LGPD** — o site é de uma clínica. O formulário de contato não armazena nada (vai direto
   para o WhatsApp), o que é ótimo, mas o log de auditoria guarda IP dos médicos.
   **Falta uma página de Política de Privacidade** no site — recomendo incluir junto.
7. **Runbook** — documento curto de "o que fazer se": painel fora do ar, Supabase pausado,
   médico esqueceu a senha, precisa reverter um artigo.

---

## 6. Cronograma e custo

| Fase | Dias | Entrega |
|---|---|---|
| 0 — Domínio e higiene | 0,5 | **Requisito 1** |
| 1 — Supabase | 0,5 | Infra pronta |
| 2 — Auth multiusuário | 1,5 | **Requisitos 2 e 3** |
| 3 — Conteúdo no Postgres | 2,5 | Edição, preview, fim do token GitHub |
| 4 — Painel usável | 2,0 | Adoção pelos médicos |
| 5 — Segurança e operação | 1,0 | Sustentação |
| **Total** | **~8 dias** | |

Os três requisitos declarados estão cobertos ao fim da **Fase 2** (~2,5 dias). As fases 3–5
são o que separa "atende o pedido" de "os médicos usam isso por anos sem chamar ninguém".

**Custo mensal**

| Item | Custo |
|---|---|
| Vercel Pro (obrigatório para uso comercial) | US$ 20/mês |
| Supabase Free | US$ 0 — exige o cron de keep-alive; sem backup automático |
| Supabase Pro *(recomendado)* | US$ 25/mês — sem pausa, backup diário, 8 GB de banco |
| Domínio `.com.br` | ~R$ 40/ano |

Mínimo viável: **US$ 20/mês**. Recomendado: **US$ 45/mês**.

---

## 7. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Supabase free pausar por inatividade | Painel e build param | Cron diário de keep-alive; ou plano Pro |
| Service role key vazar para o cliente | Acesso total ao banco | Guarda em `src/lib/db.ts` que estoura se importado no browser; item fixo de code review; `grep` no build como verificação |
| Supabase indisponível durante um build | Build falha | A Vercel mantém o deploy anterior no ar. Site nunca cai por isso. |
| Propagação de DNS demorar | Domínio fora do ar por horas | Fazer a Fase 0 primeiro, com folga antes de qualquer divulgação |
| Médico perder a senha | Sem acesso | Os 3 são admin: um redefine a do outro. Sem dependência de e-mail. |
| Perda de conteúdo na migração | Artigos perdidos | Os markdown originais ficam no repositório até a validação em produção |
| Médicos não adotarem o painel | Blog parado | Fase 4 existe exatamente para isso; fazer um treino de 30 min com os 3 |

---

## 8. O que eu deliberadamente **não** vou fazer

- **Não** vou construir matriz de permissões/RBAC — o requisito diz que os 3 são admin plenos.
- **Não** vou usar Supabase Auth — traria dependência de envio de e-mail para recuperação de
  senha, sendo que "outro admin redefine" resolve melhor para 3 pessoas.
- **Não** vou tornar o site público dinâmico (SSR/ISR) — perderia performance e SEO sem ganho.
- **Não** vou mexer em `src/data/doctors.ts` — conteúdo verbatim, revisado, e é o lugar certo
  para ele.
- **Não** vou adicionar backend ao formulário de contato — WhatsApp direto é a escolha certa
  aqui, e evita armazenar dado de saúde.

---

## 9. Decisões que preciso de você

| # | Decisão | Opções |
|---|---|---|
| 1 | **Domínio final** | `clinicarim.com.br` já é o do config. Está registrado? Em nome de quem? |
| 2 | **Arquitetura** | Supabase (recomendado, ~8 dias) ou só trocar a autenticação mantendo git-as-CMS (~1,5 dia) |
| 3 | **Plano Supabase** | Free com keep-alive, ou Pro (US$ 25) com backup automático |
| 4 | **E-mails de login** dos 3 médicos | Institucionais (`nome@clinicarim.com.br`) ou pessoais |
| 5 | **Editor** | Markdown com preview lado a lado, ou WYSIWYG tipo Word |
| 6 | **Escopo** | Fases 0–2 (só o pedido) ou 0–5 (completo) |
