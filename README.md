# Liganer (monorepo)

Código e deploy de **https://vendas.liganer.com.br**

## Apps

| Pasta | URL |
| --- | --- |
| `apps/root-index/` | `/` (home, login, auth, usuários) |
| `apps/chapas-bobinas/` | `/orcamento/chapas-bobinas/` |
| `apps/blanks-slitters/` | `/orcamento/blanks-slitters/` |
| `apps/ace/` | `/orcamento/ace/` |
| `apps/comparador-preco/` | `/comparador-preco/` |
| `apps/prospeccao/` | `/prospeccao/` |
| `packages/shared/` | código compartilhado |

## Deploy (só este repositório)

Workflows na raiz (`.github/workflows/`):

- `deploy-root-index.yml`
- `deploy-chapas-bobinas.yml`
- `deploy-blanks-slitters.yml`
- `deploy-ace.yml`
- `deploy-comparador-preco.yml`
- `deploy-prospeccao.yml`

Push em `main` (com paths do app) ou **Actions → Run workflow**.

### Secrets necessários

| Secret | Uso |
| --- | --- |
| `FTP_SERVER` | `ftp.liganer.com.br` |
| `FTP_USERNAME` | usuário FTP |
| `FTP_PASSWORD` | senha FTP |
| `ORCAMENTO_SYNC_SECRET` | sync de orçamentos (chapas) |
| `LEADS_SYNC_SECRET` / `LEADS_GITHUB_TOKEN` | sync de leads (prospecção, opcional) |

Repos antigos **não** devem ter Actions ativos — senão publicam em cima do monorepo.
