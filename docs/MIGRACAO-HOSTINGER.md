# Migração Vercel → Hostinger

Revisão feita com o site ainda na preview da Vercel. **Nada aqui derruba o que está
no ar**: o adapter é escolhido por variável de ambiente e o default continua sendo a
Vercel, então a preview segue buildando e atualizando normalmente até você decidir virar.

---

## Resumo: o cliente vai conseguir postar?

**Sim** — a Hostinger Business roda Node.js (até 5 apps), com build automático a cada
push no GitHub. É isso que torna a migração possível sem reescrever o painel: o
`/admin` precisa de servidor, e o plano tem servidor.

E a publicação ficou **bem mais simples de manter no ar** do que era quando esta
revisão começou. Os artigos saíram de arquivos markdown no repositório e foram para
a tabela `posts` no Postgres:

|                     | Antes                              | Agora                                |
| ------------------- | ---------------------------------- | ------------------------------------ |
| Publicar            | commit no GitHub → build → 1-2 min | `INSERT` — no ar na hora             |
| Editar publicado    | **não existia**                    | formulário preenchido, com histórico |
| Rascunho            | invisível até publicar             | pré-visualização no site real        |
| Dependência externa | `GITHUB_TOKEN`, que **expira**     | nenhuma                              |
| Se o token vencesse | publicar parava sem aviso          | não se aplica                        |

O `GITHUB_TOKEN` era o maior risco operacional da migração — um segredo com prazo de
validade no caminho crítico de "o médico quer publicar". Ele **não existe mais**, e
com ele saíram `GITHUB_REPO` e `GITHUB_BRANCH`.

> ### ⚠️ Em troca, apareceu uma dependência nova: o blog agora precisa do banco
>
> As páginas do blog deixaram de ser estáticas — elas leem o Postgres a cada visita.
> Antes só o painel dependia do banco; agora o `/blog` também. O resto do site (home,
> especialistas, contato) segue 100% estático e não toca o banco.
>
> A forma mais provável de isso doer não é o Supabase cair: é o **plano Free pausar o
> projeto após 7 dias sem atividade**. Por isso o item 2 abaixo (keep-alive) deixou de
> ser "bom ter" e passou a ser **obrigatório**.

---

## O que estava amarrado à Vercel

| #   | Item                                           | Situação                                                     |
| --- | ---------------------------------------------- | ------------------------------------------------------------ |
| 1   | `adapter: vercel()`                            | ✅ Resolvido — adapter agora é escolhido por `DEPLOY_TARGET` |
| 2   | Cron do `vercel.json` (keep-alive do Supabase) | ✅ Resolvido — virou GitHub Action                           |
| 3   | `allowedDomains` sem o domínio da Hostinger    | ✅ Resolvido — `*.hostingersite.com` incluído                |
| 4   | CSRF chutava o esquema do proxy                | ✅ Resolvido — compara host, não a origem inteira            |
| 5   | Segredos embutidos no build                    | ✅ Resolvido — lidos só de `process.env`, em runtime         |
| 6   | `VERCEL_DEPLOY_HOOK_URL`                       | ✅ Removido — nunca foi usado por nenhuma linha de código    |
| 7   | `vercel.json`                                  | ⏳ Apagar **depois** de virar o DNS                          |
| 8   | `@astrojs/vercel` no `package.json`            | ⏳ Remover **depois** de virar o DNS                         |

### 1. Adapter (feito)

`astro.config.mjs` agora escolhe o adapter por variável:

```
DEPLOY_TARGET=node   → @astrojs/node (standalone)  ← Hostinger
qualquer outro/vazio → @astrojs/vercel             ← default, é o que roda hoje
```

Verificado localmente: o build com `DEPLOY_TARGET=node` gera `dist/server/entry.mjs`,
o servidor sobe e responde — home 200, `/blog` 200, `/admin` redireciona para o login,
`/admin/login` renderiza com acesso ao banco, `/api/health` devolve `{"status":"ok"}`.

### 2. Keep-alive do Supabase (feito) — o risco silencioso

O plano Free do Supabase **pausa o projeto após 7 dias sem atividade no banco**. O site
público é estático e não toca o Postgres, então visitante não conta: só o painel conta.
Uma clínica que publica uma vez por mês cai nisso e encontra o painel quebrado
justamente no dia em que precisa dele.

O cron do `vercel.json` fazia esse trabalho e desaparece com a Vercel. Agora quem faz é
`.github/workflows/keep-alive.yml`, que mora no **GitHub** de propósito — sobrevive à
migração e funciona nos dois hosts e no meio do caminho.

**Ação necessária:** defina a variável `HEALTH_URL` em
`GitHub → Settings → Secrets and variables → Actions → Variables`:

- durante a transição: `https://<sua-preview>.vercel.app/api/health`
- depois do DNS: `https://clinicarim.com.br/api/health`

Rode uma vez à mão pela aba **Actions** para confirmar.

### 4. CSRF (feito) — o bug que já custou dois hotfixes

O `git log` tem dois commits consecutivos consertando 403 em POST no painel. A causa
raiz continuava no código: a verificação montava a origem esperada com
`x-forwarded-proto ?? 'https'` — um **chute** sobre o comportamento do proxy — e exigia
igualdade exata de string. Trocar de host é exatamente quando esse chute erra.

Agora compara o **host** do `Origin` com o host pedido. Não há mais nada a derivar.
Testado:

| Cenário                                         | Antes    | Agora    |
| ----------------------------------------------- | -------- | -------- |
| Mesmo host, proxy reportando esquema interno    | ❌ 403   | ✅ passa |
| `x-forwarded-host` em lista (proxy em cadeia)   | ❌ 403   | ✅ passa |
| Origem de outro site (CSRF real)                | ✅ 403   | ✅ 403   |
| Sem `Origin`, com `Sec-Fetch-Site: same-origin` | ✅ passa | ✅ passa |

### 5. Segredos no build (feito) — achado de segurança

`grep` no `dist` mostrou a **`SUPABASE_SERVICE_ROLE_KEY` em texto puro** dentro de
`dist/server/chunks/db_*.mjs`. Causa: o helper `env()` usava `import.meta.env[key]` como
fallback, e o Vite substitui `import.meta.env` em tempo de build pelo objeto inteiro do
`.env` — não dá para inlinar "só a chave lida" quando o acesso é dinâmico.

Nunca chegou ao navegador (o bundle do cliente estava limpo). Mas era a chave de
administrador do banco viajando dentro de um artefato de build — e um dos métodos de
deploy da Hostinger é justamente **subir um `.zip` do projeto**.

Corrigido: o `.env` é carregado no `process.env` uma vez em `astro.config.mjs`, e a
aplicação lê apenas `process.env`, em runtime. Reverificado com `grep`: `dist` e
`.vercel/output` limpos, e o servidor sem variáveis agora responde
`{"status":"unconfigured"}` em vez de `ok` — prova de que nada ficou embutido.

---

## Passo a passo do deploy na Hostinger

### 1. Criar o app Node

`hPanel → Websites → Add website → Node.js`

- **Deployment:** GitHub (dá build automático a cada push — é isso que faz a publicação
  do blog funcionar)
- **Repositório / branch:** `ViniciusAction/ClinicRim`, branch `main`
- **Framework:** `Other` (o Astro com adapter Node não é autodetectado)
- **Node version:** `22.x`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Entry file:** `dist/server/entry.mjs`

### 2. Variáveis de ambiente

`hPanel → Node.js → Environment variables`:

| Variável                    | Valor                  | Sem ela                                                |
| --------------------------- | ---------------------- | ------------------------------------------------------ |
| `DEPLOY_TARGET`             | `node`                 | **build sai com adapter Vercel e o app não sobe**      |
| `SUPABASE_URL`              | mesma da Vercel        | painel fecha e o blog não carrega                      |
| `SUPABASE_SERVICE_ROLE_KEY` | mesma da Vercel        | idem                                                   |
| `HOST`                      | `0.0.0.0`              | se a Hostinger não injetar, não aceita conexão externa |
| `PORT`                      | o que o painel indicar | idem                                                   |

São só essas cinco — e nenhuma expira. `GITHUB_TOKEN`, `GITHUB_REPO`,
`GITHUB_BRANCH` e `VERCEL_DEPLOY_HOOK_URL` **não são mais usadas por nenhuma linha de
código**; se estiverem na Vercel, não precisa copiá-las.

> Mudança em variável de ambiente **exige redeploy** para valer.

### 3. Antes de virar o DNS

Teste no domínio temporário (`*.hostingersite.com`) — já está em `allowedDomains`:

- [ ] Home, `/blog` e um artigo abrem
- [ ] `/admin` redireciona para `/admin/login`
- [ ] Login com uma conta de médico entra no painel
- [ ] `/api/health` responde `{"status":"ok"}`
- [ ] **Publicar um artigo de teste** → aparece em `/blog` imediatamente
- [ ] **Editar esse artigo** → a alteração vale na hora, o endereço não muda
- [ ] Salvar como **rascunho** → some do `/blog` mas abre logado (tarja amarela)
- [ ] Enviar uma **capa** → aparece no artigo (vem do Storage do Supabase)
- [ ] Excluir o artigo de teste → sai do blog na hora
- [ ] `/blog/nao-existe` responde **404** (e não 500)
- [ ] `/sitemap-blog.xml` lista os artigos publicados

Os itens de publicar/editar/excluir são o teste que importa. Se falharem, é
`SUPABASE_SERVICE_ROLE_KEY` — não há mais token de GitHub para dar problema.

### 4. Depois de virar o DNS

- [ ] `site` em `astro.config.mjs` = domínio final (afeta sitemap, RSS e Open Graph)
- [ ] `Sitemap:` em `public/robots.txt` = domínio final
- [ ] `HEALTH_URL` no GitHub apontando para o domínio final
- [ ] SSL ativo (a Hostinger emite grátis) — o cookie de sessão é `secure` em produção
      e **não funciona sem HTTPS**
- [ ] Apagar `vercel.json`, remover `@astrojs/vercel` e simplificar o adapter
- [ ] Tirar `*.vercel.app` de `allowedDomains`

---

## Como a publicação funciona agora

Publicar/editar grava na tabela `posts` do Postgres e o artigo vale na requisição
seguinte. Não há build, não há token, não há espera.

O que compõe isso:

| Peça                     | Onde             | Papel                                                 |
| ------------------------ | ---------------- | ----------------------------------------------------- |
| `posts`                  | Postgres         | os artigos (título, corpo em markdown, status, datas) |
| `post_revisions`         | Postgres         | versão anterior a cada edição — substitui o `git log` |
| `blog-covers`            | Supabase Storage | capas enviadas (público em leitura, 4 MB, só imagens) |
| `src/lib/blog.ts`        | código           | leitura + markdown → HTML **sanitizado**              |
| `src/lib/admin/posts.ts` | código           | criar / editar / excluir                              |

### Três coisas que não são óbvias

**A sanitização do markdown não é opcional.** O corpo do artigo é renderizado em
runtime e injetado com `set:html` numa página pública. O markdown do Astro deixa HTML
cru passar intacto — sem o `rehype-sanitize`, um `<script>` no corpo do artigo
executaria no navegador de todo visitante da clínica. Está em `renderPostBody()`, com
aviso no código. Não remova para "permitir um iframe".

**As capas têm dois caminhos.** Sem capa enviada, o artigo usa a arte da especialidade —
que é import estático e continua otimizada no build. Com capa enviada, o arquivo vai
para o Storage e é servido pela URL pública, sem otimização do Astro (o build não
conhece um arquivo enviado depois dele). O componente `PostCover.astro` resolve os dois.

**O sitemap dos artigos é um endpoint separado.** O `@astrojs/sitemap` roda no build e
não conhece os slugs, que agora vivem no banco. Sem `src/pages/sitemap-blog.xml.ts` os
artigos sairiam do índice — uma regressão de SEO que só apareceria meses depois. Os dois
sitemaps estão declarados em `public/robots.txt`.

### O que o cliente vê no painel

- **Publicações** — lista tudo, publicado e rascunho, com **Ver**, **Editar** e **Excluir**
- **Novo artigo / Editar** — mesmo formulário, com barra de formatação (Título, Negrito,
  Itálico, listas, citação, link), atalhos `Ctrl+B` / `Ctrl+I` / `Ctrl+K` e aba
  **Visualizar** que renderiza pelo mesmo caminho da página publicada
- **Rascunho** — fora do blog, do RSS e do sitemap; abre no site real para quem está
  logado, com tarja de aviso

O editor grava **Markdown** por baixo. Os botões só escrevem a marcação, então o cliente
não precisa decorar `**` nem `##` — e nada no resto do sistema depende do editor.

---

## Migração dos artigos antigos (já feita)

Os dois artigos que estavam em `src/content/blog/*.md` foram para o banco com
`npm run migrate:posts -- --apply`, preservando slug, data de publicação, autor,
especialidade e tags. Os arquivos `.md`, o `src/content.config.ts` e o
`src/lib/admin/github.ts` foram removidos — o histórico deles continua no git.

O script é idempotente e tem dry-run por padrão. Ficou no repositório como registro de
como a migração foi feita.
