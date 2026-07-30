# DNS de clinicarim.com.br — retrato antes da migração

Levantado em **30/07/2026**, antes de trocar o site do domínio de WordPress para o
app Node.js. Serve para duas coisas: provar que **não há nada a alterar no
registro.br**, e ser a referência de restauração caso algum registro seja perdido.

---

## ⚠️ Não mexa nos nameservers no registro.br

```
Servidor 1: ns1.dns-parking.com
Servidor 2: ns2.dns-parking.com
```

**Esses já SÃO os nameservers da Hostinger.** `dns-parking.com` é o hostname que a
Hostinger usa para o DNS dela — os IPs (`162.159.24.201`, `162.159.25.42`) são da
infraestrutura anycast da Cloudflare, que a Hostinger usa por baixo.

A prova está no SOA da zona:

```
servidor primário: ns1.dns-parking.com
responsável:       dns.hostinger.com     ← zona administrada pela Hostinger
```

### O botão "UTILIZAR DNS DO REGISTRO.BR" é destrutivo

Ele move a zona para o DNS do registro.br, que nasce vazio. O efeito imediato:

| Perde                | Consequência                                                      |
| -------------------- | ----------------------------------------------------------------- |
| MX, SPF, DKIM, DMARC | **e-mail da clínica para de funcionar**; o que sair vai para spam |
| autodiscover         | Outlook e celular param de configurar a conta                     |
| A / AAAA             | site sai do ar                                                    |

Isso vale para SEMPRE, não só durante a migração. Toda a troca de site acontece
**dentro do hPanel** (`Websites → app Node.js → Domains`). Nada nesta migração
exige tocar no registro.br.

---

## Zona completa

| Nome                                           | Tipo    | Valor                                         |
| ---------------------------------------------- | ------- | --------------------------------------------- |
| `clinicarim.com.br`                            | NS      | `ns1.dns-parking.com`                         |
| `clinicarim.com.br`                            | NS      | `ns2.dns-parking.com`                         |
| `clinicarim.com.br`                            | A       | `212.85.6.102`                                |
| `clinicarim.com.br`                            | AAAA    | `2a02:4780:13:2137:0:dd1:5d2:3`               |
| `www.clinicarim.com.br`                        | CNAME   | `clinicarim.com.br`                           |
| `clinicarim.com.br`                            | MX (5)  | `mx1.hostinger.com`                           |
| `clinicarim.com.br`                            | MX (10) | `mx2.hostinger.com`                           |
| `clinicarim.com.br`                            | TXT     | `v=spf1 include:_spf.mail.hostinger.com ~all` |
| `_dmarc.clinicarim.com.br`                     | TXT     | `v=DMARC1; p=none`                            |
| `autodiscover.clinicarim.com.br`               | CNAME   | `autodiscover.mail.hostinger.com`             |
| `hostingermail-a._domainkey.clinicarim.com.br` | CNAME   | `hostingermail-a.dkim.mail.hostinger.com`     |
| `hostingermail-b._domainkey.clinicarim.com.br` | CNAME   | `hostingermail-b.dkim.mail.hostinger.com`     |
| `hostingermail-c._domainkey.clinicarim.com.br` | CNAME   | `hostingermail-c.dkim.mail.hostinger.com`     |

Os registros de A/AAAA são os únicos que mudam ao trocar qual site atende o
domínio — e a própria Hostinger os ajusta. Todo o resto é e-mail e **não deve ser
tocado**.

O e-mail está com SPF + DKIM (três chaves) + DMARC configurados, ou seja, é um
domínio de e-mail em uso real e bem configurado — não sobra de instalação.

---

## Domínio canônico: o apex, sem `www`

Verificado no ar:

| URL                              | Resposta                               |
| -------------------------------- | -------------------------------------- |
| `http://clinicarim.com.br/`      | 301 → `https://clinicarim.com.br/`     |
| `https://clinicarim.com.br/`     | **200** ← canônico                     |
| `http://www.clinicarim.com.br/`  | 301 → `https://www.clinicarim.com.br/` |
| `https://www.clinicarim.com.br/` | 301 → `https://clinicarim.com.br/`     |

O `<link rel="canonical">` do site atual também aponta para o apex. Por isso
`site` em `astro.config.mjs` é `https://clinicarim.com.br` (estava com `www`, ao
contrário do que o domínio faz — corrigido).

> Depois do cutover, **teste `https://www.clinicarim.com.br/`**. Hoje quem faz o
> redirect para o apex é o LiteSpeed do WordPress. Se a Hostinger não mantiver
> esse comportamento para app Node, `www` passa a servir o site direto e vira
> conteúdo duplicado — ou quebra. O conserto é um redirect no middleware.

---

## O que havia no WordPress (para o registro)

Instalação de starter template, sem conteúdo real:

- 1 página (`Home`, do template) e 1 post (`hello-world`, exemplo padrão do WordPress)
- Nenhuma menção a nome de médico, especialidade ou cidade no HTML
- Plugins: `astra-sites`, `sureforms`, `hostinger-reach`, `ultimate-addons-for-gutenberg`
- 51 arquivos de mídia, quase todos imagens de demonstração do template

**Antes de apagar**, conferir no wp-admin (não é visível de fora):

- [ ] **SureForms** — submissões de formulário ficam no banco do WordPress. Se algum
      paciente preencheu algo, está lá e some com o site.
- [ ] **Hostinger Reach** — contatos/inscritos coletados.
- [ ] Baixar os originais de `LOGO-2025-PNG-scaled.png` e `Logo-com-Alfa-*.png`;
      podem estar em resolução maior que os de `src/assets/logos/`.
