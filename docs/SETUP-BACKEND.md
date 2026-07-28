# Setup do backend — passo a passo

Guia de execução das **Fases 1 e 2** do [PLANO-BACKEND.md](PLANO-BACKEND.md).
O código já está no repositório; o que falta são as etapas que só você pode fazer
(criar a conta no Supabase, definir os e-mails dos médicos).

Tempo estimado: **20 minutos**. Domínio próprio **não é necessário** — tudo funciona
na URL `.vercel.app`.

---

## 1. Criar o projeto no Supabase · ~5 min

1. Acesse [supabase.com](https://supabase.com) e crie a conta (pode ser com o GitHub).
2. **New project**:
   - **Name:** `clinica-rim`
   - **Database Password:** gere uma forte e guarde **no gerenciador de senhas**.
     Não vamos usá-la no dia a dia, mas é a senha de recuperação do banco.

     > ⚠️ **Não anote a senha neste arquivo.** Ele é versionado no git: uma senha
     > escrita aqui vai para o histórico do repositório e continua lá mesmo depois
     > de apagada do arquivo. Se isso já aconteceu, rotacione em
     > **Supabase > Project Settings > Database > Reset database password**.

   - **Region:** `South America (São Paulo)` — menor latência para a clínica.
   - **Plan:** Free por enquanto.
3. Aguarde ~2 min enquanto o projeto sobe.

## 2. Aplicar o schema · ~2 min

1. No projeto: menu lateral → **SQL Editor** → **New query**.
2. Abra [supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql),
   copie o arquivo **inteiro** e cole no editor.
3. **Run**. Deve terminar com `Success. No rows returned`.
4. Repita com [supabase/migrations/0002_contas_de_equipe.sql](../supabase/migrations/0002_contas_de_equipe.sql)
   — libera contas de painel que não são médicos (agência, secretaria).
5. Confira em **Table Editor**: devem aparecer 5 tabelas — `admin_users`,
   `admin_sessions`, `posts`, `post_revisions`, `admin_audit_log`.

> Rode a `0001` **uma vez só**. Ela cria as tabelas do zero; rodar de novo dá erro
> de "já existe", o que é inofensivo mas confuso. A `0002` é idempotente.

## 2b. Criar o bucket das capas · ~1 min

**Storage** → **New bucket**:

- **Name:** `blog-covers`
- **Public bucket:** ✅ sim (leitura pública — é de lá que o site serve as capas)
- **File size limit:** `4 MB`
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`

Sem esse bucket, publicar funciona mas **enviar capa falha** — o artigo cai na arte
padrão da especialidade. Os limites são reforçados pelo próprio Storage, além da
validação do formulário.

## 3. Pegar as credenciais · ~1 min

**Project Settings** (engrenagem) → **API**:

| Onde                                  | O que copiar                       |
| ------------------------------------- | ---------------------------------- |
| Project URL                           | vai em `SUPABASE_URL`              |
| Project API keys → **`service_role`** | vai em `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ É a chave **`service_role`**, não a `anon`. Ela ignora as políticas de RLS e tem
> poder total sobre o banco — trate como senha de administrador. Ela só é lida no
> servidor; nunca deve aparecer em código de navegador, em print de tela ou em mensagem.

## 4. Configurar o ambiente local · ~2 min

Na raiz do projeto, copie `.env.example` para `.env` e preencha:

```bash
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

O `.env` já está no `.gitignore` — não vai para o repositório.

## 5. Criar as contas dos três médicos · ~2 min

Decida o e-mail de login de cada um. Como **não há envio de e-mail em nenhum
momento** (recuperação de senha é feita por outro médico dentro do painel), o
e-mail funciona apenas como identificador — pode ser o que cada um já usa.

```bash
npm run seed:admins -- dr-alexandre=alexandre@exemplo.com \
                       dra-bruna=bruna@exemplo.com \
                       dr-igor=igor@exemplo.com
```

A saída traz **uma senha temporária por médico**, no formato `XXXX-XXXX-XXXX-XXXX`:

```
────────────────────────────────────────────────────────────────────────
SENHAS TEMPORÁRIAS — anote agora, não serão exibidas de novo.
────────────────────────────────────────────────────────────────────────

  Dr. Alexandre Pipino
  e-mail: alexandre@exemplo.com
  senha:  XXXX-XXXX-XXXX-XXXX
  ...
```

Entregue cada senha **pessoalmente ou por telefone** — nunca por e-mail ou WhatsApp.
No primeiro acesso o painel bloqueia tudo até o médico escolher uma senha própria.

> O script é idempotente: rodar de novo não altera quem já existe. Para trocar a
> senha de alguém depois, use **Equipe → Redefinir senha** dentro do painel.
>
> Requer Node 22.18+ ou 24+ (o script é TypeScript executado direto pelo Node).
> A versão instalada aqui é a 24 — ok.

## 6. Testar local · ~3 min

```bash
npm run dev
```

Roteiro de verificação em `http://localhost:4321`:

- [ ] `/admin` redireciona para `/admin/login`
- [ ] Senha errada 1× → "E-mail ou senha incorretos"
- [ ] Errar 5× o mesmo e-mail → mensagem de bloqueio por 15 minutos
- [ ] Login com a senha temporária → cai direto em **Minha conta**, com o aviso amarelo
- [ ] Tentar abrir `/admin` sem trocar a senha → volta para **Minha conta**
- [ ] Trocar a senha (mínimo 12 caracteres) → painel libera
- [ ] Cabeçalho mostra o nome do médico logado
- [ ] **Equipe** lista os 3, com "você" na sua linha
- [ ] Redefinir a senha de um colega → mostra a senha temporária uma vez
- [ ] **Minha conta** lista os dispositivos conectados
- [ ] **Sair** → `/admin` volta a exigir login
- [ ] `/api/health` responde `{"status":"ok"}`

## 7. Publicar na Vercel · ~5 min

1. **Vercel → Project → Settings → Environment Variables**, escopo
   **Production** e **Preview**:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. **Remova** as variáveis antigas, que não são mais usadas:
   `ADMIN_USER`, `ADMIN_PASSWORD`, `AUTH_SECRET`.
3. Faça o deploy. O [vercel.json](../vercel.json) registra sozinho o cron diário
   que mantém o Supabase acordado (o plano gratuito pausa o projeto após 7 dias
   sem atividade).
4. Repita o roteiro do passo 6 na URL `.vercel.app`.

> O `npm run seed:admins` roda **uma vez só**, contra o banco — não por ambiente.
> Como local e produção usam o mesmo projeto Supabase, as contas criadas no passo 5
> já valem no ar.

---

## Como fica a operação

| Situação                     | O que fazer                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Médico esqueceu a senha      | Outro médico: **Equipe → Redefinir senha**. Passa a temporária por telefone.                       |
| Notebook perdido/roubado     | **Equipe → Suspender acesso** (derruba as sessões na hora). Depois **Redefinir senha** e reativar. |
| Trocar a própria senha       | **Minha conta → Trocar senha**. Desconecta os outros dispositivos automaticamente.                 |
| Ver acessos suspeitos        | **Minha conta → Dispositivos conectados**                                                          |
| Painel diz "não configurado" | Faltam as variáveis do Supabase na Vercel                                                          |

**Regras embutidas no sistema:**

- Sessão de 12h, renovada enquanto o painel estiver em uso.
- 5 senhas erradas no mesmo e-mail (ou 15 no mesmo IP) bloqueiam o login por 15 min.
- Senha mínima de 12 caracteres; nome, e-mail e palavras óbvias são recusados.
- Trocar ou redefinir uma senha invalida as sessões abertas daquela conta.
- Não é possível suspender a própria conta nem o último acesso ativo do painel.

---

## Fase 3 — concluída

Os artigos **não moram mais em arquivos**. Saíram de `src/content/blog/*.md` e foram
para a tabela `posts` no Postgres. O que mudou na prática:

|                    | Antes                              | Agora                                      |
| ------------------ | ---------------------------------- | ------------------------------------------ |
| Publicar           | commit no GitHub → build → 1-2 min | `INSERT` — no ar na hora                   |
| Editar publicado   | não existia                        | formulário preenchido, endereço preservado |
| Rascunho           | invisível até publicar             | abre no site real para quem está logado    |
| Histórico          | `git log`                          | tabela `post_revisions`, no próprio painel |
| Segredo necessário | `GITHUB_TOKEN` (expira)            | nenhum a mais                              |

`GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH` e `VERCEL_DEPLOY_HOOK_URL` foram
removidas — nenhuma linha de código as usa. `src/lib/admin/github.ts`,
`src/content.config.ts` e os `.md` também saíram (o histórico segue no git).

**O editor não exige saber Markdown.** A barra de formatação tem Título, Negrito,
Itálico, listas, citação e link, com `Ctrl+B` / `Ctrl+I` / `Ctrl+K`, e a aba
**Visualizar** renderiza pelo mesmo caminho da página publicada — o que aparece na
prévia é o que vai ao ar.

### Duas coisas para saber

**O blog agora depende do banco.** As páginas de `/blog` leem o Postgres a cada visita.
O resto do site (home, especialistas, contato) segue estático e não toca o banco. O
`keep-alive` deixou de ser opcional — ver abaixo.

**O `vercel.json` não serve mais como keep-alive na Hostinger.** Quem mantém o projeto
Supabase acordado é `.github/workflows/keep-alive.yml`, que vive no GitHub para
sobreviver à troca de host. Defina a variável `HEALTH_URL` em
**GitHub → Settings → Secrets and variables → Actions → Variables**.

Detalhes da migração e o passo a passo do deploy: [MIGRACAO-HOSTINGER.md](MIGRACAO-HOSTINGER.md).
