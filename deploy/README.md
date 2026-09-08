# Deploy automático via FTP

Tudo sobe pela Action: site + leads. Sem FileZilla no dia a dia.

## Fluxo

```
push/merge na main
    → build (web/dist + LEADS.csv)
    → FTP → /public_html/prospeccao/
```

## 1) Secrets (neste repositório)

GitHub → **Settings → Secrets and variables → Actions** → New secret:

| Secret | Exemplo |
| ------ | ------- |
| `FTP_HOST` | `ftp.seudominio.com.br` |
| `FTP_USER` | usuário FTP |
| `FTP_PASSWORD` | senha FTP |
| `FTP_SERVER_DIR` | `/public_html/prospeccao/` |
| `FTP_PROTOCOL` | `ftp` ou `ftps` (opcional; padrão `ftp`) |

> `FTP_SERVER_DIR` deve ser a pasta do **site** (`/prospeccao/`), não só `/data/`.

## 2) Primeira publicação

1. Crie a pasta `prospeccao` na hospedagem (vazia ok).
2. Merge deste PR / rode **Actions → Deploy prospecção → FTP → Run workflow**.
3. Abra `https://vendas.liganer.com.br/prospeccao/`

## 3) Dia a dia

| Alteração | O que fazer |
| --------- | ----------- |
| Leads | Editar `LEADS.csv` → merge `main` → automático |
| Sistema (tela/código) | Commit no `web/` → merge `main` → automático |

No site, use **Atualizar** ou F5 após o Action ficar verde.

## 4) DNS / domínio

Aponte `vendas.liganer.com.br` para a hospedagem e use a pasta `prospeccao` (ou o docroot que o painel indicar). O `.htaccess` já vai no deploy para SPA no Apache.
