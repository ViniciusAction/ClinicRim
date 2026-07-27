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
   - **Database Password:** gere uma forte e guarde no gerenciador de senhas.
     Não vamos usá-la no dia a dia, mas é a senha de recuperação do banco.
   - **Region:** `South America (São Paulo)` — menor latência para a clínica.
   - **Plan:** Free por enquanto.
3. Aguarde ~2 min enquanto o projeto sobe.

## 2. Aplicar o schema · ~2 min

1. No projeto: menu lateral → **SQL Editor** → **New query**.
2. Abra [supabase/migrations/0001_init.sql](../supabase/migrations/0001_init.sql),
   copie o arquivo **inteiro** e cole no editor.
3. **Run**. Deve terminar com `Success. No rows returned`.
4. Confira em **Table Editor**: devem aparecer 5 tabelas — `admin_users`,
   `admin_sessions`, `posts`, `post_revisions`, `admin_audit_log`.

> Rode este arquivo **uma vez só**. Ele cria as tabelas do zero; rodar de novo dá erro
> de "já existe", o que é inofensivo mas confuso.

## 3. Pegar as credenciais · ~1 min

**Project Settings** (engrenagem) → **API**:

| Onde | O que copiar |
|---|---|
| Project URL | vai em `SUPABASE_URL` |
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

A saída traz **uma senha temporária por médico**, no formato `A7K2-9PXM-4RTQ-8WZN`:

```
────────────────────────────────────────────────────────────────────────
SENHAS TEMPORÁRIAS — anote agora, não serão exibidas de novo.
────────────────────────────────────────────────────────────────────────

  Dr. Alexandre Pipino
  e-mail: alexandre@exemplo.com
  senha:  A7K2-9PXM-4RTQ-8WZN
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

| Situação | O que fazer |
|---|---|
| Médico esqueceu a senha | Outro médico: **Equipe → Redefinir senha**. Passa a temporária por telefone. |
| Notebook perdido/roubado | **Equipe → Suspender acesso** (derruba as sessões na hora). Depois **Redefinir senha** e reativar. |
| Trocar a própria senha | **Minha conta → Trocar senha**. Desconecta os outros dispositivos automaticamente. |
| Ver acessos suspeitos | **Minha conta → Dispositivos conectados** |
| Painel diz "não configurado" | Faltam as variáveis do Supabase na Vercel |

**Regras embutidas no sistema:**

- Sessão de 12h, renovada enquanto o painel estiver em uso.
- 5 senhas erradas no mesmo e-mail (ou 15 no mesmo IP) bloqueiam o login por 15 min.
- Senha mínima de 12 caracteres; nome, e-mail e palavras óbvias são recusados.
- Trocar ou redefinir uma senha invalida as sessões abertas daquela conta.
- Não é possível suspender a própria conta nem o último acesso ativo do painel.

---

## Próximo passo (Fase 3)

Os artigos ainda moram em `src/content/blog` e são publicados por commit no GitHub —
por isso `GITHUB_TOKEN` e `GITHUB_REPO` continuam no `.env.example`. A Fase 3 move o
conteúdo para a tabela `posts` (já criada pela migration) e traz **edição de artigo
publicado** e **pré-visualização de rascunho**, que hoje não existem.
