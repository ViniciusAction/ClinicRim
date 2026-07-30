# Colocar o site no domínio clinicarim.com.br

Caminho escolhido: **o site continua hospedado na Vercel, e o domínio passa a
apontar para lá.** O e-mail continua na Hostinger, intocado.

Por que este caminho: o site já está no ar e funcionando na Vercel, então não há
nada a construir — só a apontar. Não exige plano Business na Hostinger, não exige
criar app Node.js, não exige mexer no WordPress, e é reversível em minutos.

O código continua pronto para migrar para a Hostinger depois, sem pressa e sem o
site fora do ar: é a variável `DEPLOY_TARGET=node` (ver
[MIGRACAO-HOSTINGER.md](MIGRACAO-HOSTINGER.md)).

---

## O que NÃO se toca em nenhum momento

- ❌ **registro.br** — nada. Os nameservers já são da Hostinger e continuam sendo.
- ❌ **MX, SPF, DKIM, DMARC, autodiscover** — é o e-mail da clínica. Ver
  [DNS-clinicarim.md](DNS-clinicarim.md).
- ❌ **O WordPress** — ele fica órfão (ninguém mais chega nele pelo domínio), mas
  segue instalado. Apagar depois, com calma, e só após conferir o que está listado
  no fim daquele documento.

Só **dois** registros mudam: `A` e `AAAA` do apex, mais o `CNAME` do `www`.

---

## Passo 1 — Atualizar a `main`

A Vercel publica no domínio o que está na branch `main`. Hoje ela tem o site
antigo; todo o trabalho novo está em `feat/blog-postgres-e-preparo-hostinger`.

**Antes de apontar o domínio**, a branch precisa ser mesclada na `main` e a Vercel
precisa terminar o deploy de produção. Sem isso, o domínio passaria a servir a
versão velha.

Depois do merge, confira em `https://clinic-rim.vercel.app`:

- [ ] O botão flutuante de WhatsApp aparece ao rolar
- [ ] `/blog` lista os dois artigos
- [ ] `/admin` pede login, e a listagem tem o botão **Editar**
- [ ] `/sitemap-blog.xml` responde (hoje dá 404 — é como se sabe que o deploy novo entrou)

## Passo 2 — Adicionar o domínio na Vercel

`Vercel → Project → Settings → Domains → Add`

Adicione os dois:

- `clinicarim.com.br`
- `www.clinicarim.com.br`

Marque **`clinicarim.com.br` (sem www) como principal**, com o `www`
redirecionando para ele. É o que o domínio já faz hoje e é o que está configurado
em `astro.config.mjs` (`site`), no `robots.txt` e nos sitemaps.

A Vercel vai mostrar os valores de DNS exatos que ela quer. **Use os valores que
aparecerem na tela dela**, não os deste documento — eles podem mudar e são
específicos do projeto. Tipicamente é:

| Para                    | Tipo  | Valor                                           |
| ----------------------- | ----- | ----------------------------------------------- |
| `clinicarim.com.br`     | A     | um IP que a Vercel informa                      |
| `www.clinicarim.com.br` | CNAME | um host `*.vercel-dns.com` que a Vercel informa |

Nesse momento a Vercel vai dizer "Invalid Configuration" nos dois. É esperado — o
DNS ainda aponta para a Hostinger. Resolve no passo 3.

## Passo 3 — Trocar os registros no hPanel

> ### Sem acesso ao hPanel do cliente?
>
> **Você não precisa de acesso.** Este passo são três edições de DNS; o próprio
> cliente pode fazê-las em 10 minutos com a lista pronta que está no fim deste
> documento ("Texto para enviar ao cliente").
>
> Se ainda assim quiser o acesso, a causa mais comum de "dei acesso mas não
> aparece nada" está na própria documentação da Hostinger: **compartilhar o plano
> de hospedagem NÃO compartilha os domínios conectados** — é preciso liberar cada
> serviço separadamente em _Managed services_. E o editor de DNS fica sob o
> serviço de **domínio**, não sob o de hospedagem.
>
> O que verificar, em ordem:
>
> 1. O convite foi **aceito**? Ele chega por e-mail e exige clicar no link.
>    Confira a caixa de spam.
> 2. Foi enviado para o **mesmo e-mail** com que você faz login na Hostinger?
> 3. A conta compartilhada aparece em
>    `hpanel.hostinger.com/profile/account-access/account-sharing`, e não na sua
>    lista normal de sites. Lá tem um botão **Manage** que entra na conta do
>    cliente.
> 4. O cliente liberou o **domínio** `clinicarim.com.br`, e não só o plano?
>
> **Caminho mais fácil que pedir para o cliente configurar:** peça você mesmo o
> acesso pelo fluxo de _request_ da Hostinger. Aí o cliente só precisa clicar em
> aprovar, sem ter que achar as telas de compartilhamento.

`hPanel → Domains → clinicarim.com.br → DNS / Nameservers → DNS Records`

### 3.1 Registro `A` do apex

Encontre o registro `A` com nome `@` (ou `clinicarim.com.br`) e valor
`212.85.6.102`. **Edite** o valor para o IP que a Vercel informou.

### 3.2 Registro `AAAA` do apex — não esqueça este

Existe um `AAAA` (IPv6) apontando para `2a02:4780:13:2137:0:dd1:5d2:3`.

> ⚠️ **Este é o passo que mais gera "mudei o DNS e não funcionou".**
> Se o `AAAA` ficar apontando para a Hostinger, todo visitante com IPv6 — que é a
> maioria em rede móvel — continua caindo no WordPress antigo, enquanto quem está
> em IPv4 vê o site novo. O sintoma é péssimo de diagnosticar: "funciona no meu
> computador mas no celular aparece o site velho".

**Apague o registro `AAAA`**, a menos que a Vercel informe um IPv6 próprio. Sem
`AAAA`, o navegador usa IPv4 e vai para a Vercel.

### 3.3 Registro `CNAME` do `www`

Hoje é `www` → `clinicarim.com.br`. Troque o destino para o host `*.vercel-dns.com`
que a Vercel informou.

### 3.4 Confira que você NÃO alterou

Antes de salvar, confirme que continuam intactos:

- `MX` → `mx1.hostinger.com` (5) e `mx2.hostinger.com` (10)
- `TXT` do apex → `v=spf1 include:_spf.mail.hostinger.com ~all`
- `TXT` de `_dmarc` → `v=DMARC1; p=none`
- `CNAME` de `autodiscover` → `autodiscover.mail.hostinger.com`
- os três `CNAME` de `hostingermail-a/b/c._domainkey`

## Passo 4 — Esperar e verificar

Propagação costuma levar de minutos a ~2 horas. Na Vercel, os dois domínios
passam de "Invalid Configuration" para **Valid**, e ela emite o certificado SSL
automaticamente.

Verificar:

- [ ] `https://clinicarim.com.br/` abre o site novo
- [ ] `https://www.clinicarim.com.br/` redireciona para o apex
- [ ] O cadeado de HTTPS está válido
- [ ] `https://clinicarim.com.br/blog` lista os artigos
- [ ] `https://clinicarim.com.br/admin` pede login **e o login funciona**
      (o cookie de sessão é `secure`; só funciona depois do SSL ativo)
- [ ] **Enviar e receber um e-mail** de uma conta `@clinicarim.com.br`
- [ ] Abrir o site **no 4G do celular**, não só no Wi-Fi — é o teste que pega o
      `AAAA` esquecido

## Passo 5 — Ajustes depois que estiver no ar

- [ ] `HEALTH_URL` no GitHub (`Settings → Secrets and variables → Actions →
    Variables`) = `https://clinicarim.com.br/api/health`. É o keep-alive que
      impede o Supabase de pausar por inatividade — e agora que o blog lê o banco,
      um projeto pausado derruba o `/blog`.
- [ ] Google Search Console: adicionar a propriedade e enviar
      `sitemap-index.xml` e `sitemap-blog.xml`
- [ ] Conferir SureForms e Hostinger Reach no wp-admin, e só então decidir sobre
      apagar o WordPress (ver [DNS-clinicarim.md](DNS-clinicarim.md))

---

## Como voltar atrás

Se algo der errado, o rollback é o mesmo caminho ao contrário, no hPanel:

1. `A` do apex → `212.85.6.102`
2. Recriar o `AAAA` → `2a02:4780:13:2137:0:dd1:5d2:3`
3. `CNAME` do `www` → `clinicarim.com.br`

O WordPress volta a atender em minutos. O e-mail nunca é afetado em nenhuma
direção, porque nada de e-mail é tocado.

---

## Texto para enviar ao cliente

Para quando o cliente vai fazer as edições. **Preencha os dois valores marcados
com os que a Vercel mostrar no Passo 2** — sem eles a instrução não serve.

> Oi! Para colocar o site novo no ar em clinicarim.com.br, preciso que você
> altere **3 registros de DNS**. São 10 minutos e não afeta o e-mail da clínica.
>
> No hPanel da Hostinger: **Domains → clinicarim.com.br → DNS / Nameservers**
>
> **1) Editar o registro `A`**
> Procure o tipo `A` com nome `@`, valor `212.85.6.102`.
> Troque o valor para: `__________` (informado pela Vercel)
>
> **2) APAGAR o registro `AAAA`**
> Procure o tipo `AAAA` com nome `@`, valor `2a02:4780:13:2137:0:dd1:5d2:3`.
> Apague esse registro. _(Este passo é o mais importante: se ele ficar, quem
> acessa pelo 4G continua vendo o site antigo e quem está no Wi-Fi vê o novo.)_
>
> **3) Editar o registro `CNAME` do `www`**
> Procure o tipo `CNAME` com nome `www`, valor `clinicarim.com.br`.
> Troque o valor para: `__________` (informado pela Vercel)
>
> ⚠️ **Não altere nem apague nenhum outro registro.** Os demais são o e-mail da
> clínica (MX, SPF, DKIM, DMARC, autodiscover) — se mexer, o e-mail
> `@clinicarim.com.br` para de funcionar.
>
> Depois de salvar, me avise. Em até 2 horas o site novo aparece.

---

## Se o cliente não fizer e o acesso não vier

Último recurso: o domínio é um `.com.br` no **registro.br**, e lá dá para trocar
os nameservers para um provedor de DNS que você controla (a Cloudflare tem plano
gratuito). Aí a gestão do DNS sai da Hostinger e passa a ser sua.

**Isso funciona, mas é o caminho de maior risco**, e só deve ser feito com a zona
inteira recriada ANTES de apontar os nameservers — porque o e-mail depende dela.
Todos os registros necessários estão em [DNS-clinicarim.md](DNS-clinicarim.md):
MX (2), SPF, DMARC, autodiscover e as três chaves DKIM. Se qualquer um faltar, o
e-mail da clínica quebra.

Ordem obrigatória, se for por esse caminho:

1. Criar a zona na Cloudflare e recriar **todos** os registros de e-mail
2. Conferir um por um contra o DNS-clinicarim.md
3. Adicionar A/CNAME apontando para a Vercel
4. **Só então** trocar os nameservers no registro.br
5. Testar envio e recebimento de e-mail

Fazer na ordem inversa — trocar o nameserver primeiro — deixa o e-mail fora do ar
durante a propagação, que pode levar horas.
