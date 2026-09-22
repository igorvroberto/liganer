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

### Erro: `PUT GitHub HTTP 404` / “CSV local atualizado, mas falhou o commit”

O CSV na hospedagem gravou; o commit no GitHub não. Em repositório **privado**, o GitHub responde **404** (não 403) quando o token não enxerga o repo ou não tem escrita.

1. Crie um novo PAT em GitHub → Settings → Developer settings → Personal access tokens:
   - **Classic:** marque o escopo `repo` (acesso total a privados).
   - **Fine-grained:** Resource owner = dono do repo; só o repositório `liganer-prospeccao`; permissão **Contents: Read and write**.
2. Atualize o secret de Actions **`LEADS_GITHUB_TOKEN`** com esse token.
3. Confirme **`LEADS_GITHUB_REPO`** = `igorvroberto/liganer-prospeccao` (ou apague o secret para usar o padrão).
4. Rode **Actions → Deploy prospecção → FTP → Run workflow** (isso regenera `api/config.local.php` na hospedagem).
5. Edite um lead de novo — deve aparecer “Salvo no servidor e no GitHub”.

> Só trocar o secret **não** atualiza o PHP já publicado; o deploy FTP é obrigatório.

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
