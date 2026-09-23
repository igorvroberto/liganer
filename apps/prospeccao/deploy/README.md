# Deploy automático via FTP

Tudo sobe pela Action: site + leads + API de sync. Sem FileZilla no dia a dia.

## Fluxo

```
push/merge na main
    → build (web/dist + LEADS.csv)
    → gera api/config.local.php + syncSecret em config.json (se secrets existirem)
    → FTP → pasta /prospeccao/
```

Edição/remoção no site:

```
UI → POST /prospeccao/api/leads.php
    → grava data/leads.csv (imediato)
    → commit em radar-comercial/LEADS.csv no GitHub
    → Action FTP republica (espelho)
```

## 1) Secrets FTP (obrigatórios para publicar)

GitHub → **Settings → Secrets and variables → Actions** → New secret:

| Secret | Exemplo |
| ------ | ------- |
| `FTP_HOST` | `ftp.liganer.com.br` |
| `FTP_USER` | `acesso@liganer.com.br` |
| `FTP_PASSWORD` | senha FTP |
| `FTP_SERVER_DIR` | `/vendas.liganer.com.br/prospeccao/` |
| `FTP_PROTOCOL` | `ftp` ou `ftps` (opcional; padrão `ftp`) |

> `FTP_SERVER_DIR` deve ser a pasta do **site** (`/prospeccao/`), não só `/data/`.

## 2) Secrets do sync automático (editar/remover → CSV)

| Secret | Para quê |
| ------ | -------- |
| `LEADS_SYNC_SECRET` | Senha compartilhada entre o app e o PHP (gere uma string longa) |
| `LEADS_GITHUB_TOKEN` | Personal Access Token (classic `repo` ou fine-grained com **Contents: Read and write** neste repositório). Token só de leitura gera 404 no commit. |

Opcionais:

| Secret / Variable | Padrão |
| ----------------- | ------ |
| `LEADS_GITHUB_REPO` | `igorvroberto/liganer-prospeccao` |
| `LEADS_GITHUB_BRANCH` | `main` |

Sem `LEADS_SYNC_SECRET` + `LEADS_GITHUB_TOKEN`, o site sobe normalmente, mas edições ficam só no navegador (como antes).

### Erro: `Repo inacessível com este token (HTTP 404)` / falha no commit GitHub

O CSV na hospedagem gravou; o commit no GitHub não. Em repositório **privado**, o GitHub responde **404** quando o token não enxerga o repo ou não tem escrita.

**Faça nesta ordem (obrigatório o passo 4):**

1. Abra https://github.com/settings/tokens → **Generate new token (classic)** → marque **`repo`** → Generate.
2. Repo → **Settings → Secrets and variables → Actions** → edite **`LEADS_GITHUB_TOKEN`** e cole o token novo.
3. Se existir secret **`LEADS_GITHUB_REPO`**, confira se é exatamente `igorvroberto/liganer-prospeccao` (senão apague o secret).
4. **Actions → Deploy prospecção → FTP → Run workflow** — isso publica o token novo em `api/config.local.php`. Sem este passo o site continua com o token velho.
5. No log do job, o passo *Write sync API config* deve mostrar `Token OK para igorvroberto/liganer-prospeccao`. Se falhar aí, o PAT ainda está errado.
6. No site, edite um lead — deve aparecer **Salvo no servidor e no GitHub**.

> Fine-grained também serve: Resource owner = dono do repo, só `liganer-prospeccao`, **Contents: Read and write**. Classic `repo` é o caminho mais simples.

## 3) Primeira publicação

1. Crie a pasta `prospeccao` na hospedagem (vazia ok).
2. Cadastre os secrets FTP + sync.
3. Merge deste PR / rode **Actions → Deploy prospecção → FTP → Run workflow**.
4. Abra `https://vendas.liganer.com.br/prospeccao/`
5. Edite ou remova um lead — o status deve mostrar **Salvo no servidor e no GitHub**.

> A hospedagem precisa de **PHP com cURL**. O site deve continuar protegido por senha do painel (o `syncSecret` vai no `config.json` só para quem já acessa o CRM).

## 4) Dia a dia

| Alteração | O que fazer |
| --------- | ----------- |
| Leads no site | Editar/remover na tela — automático |
| Leads no GitHub | Editar `LEADS.csv` → merge `main` → FTP automático |
| Sistema (tela/código) | Commit no `web/` → merge `main` → automático |

## 5) DNS / domínio

Aponte `vendas.liganer.com.br` para a hospedagem e use a pasta `prospeccao`. O `.htaccess` já vai no deploy para SPA no Apache.
