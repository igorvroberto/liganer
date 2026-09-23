# liganer

Monorepo dos apps de vendas Liganer (`vendas.liganer.com.br`).

## Apps

| Pasta | Destino |
| --- | --- |
| `apps/root-index/` | Raiz do domínio — home, login, auth (`/`, `/login.html`, `/auth/*`) |
| `apps/chapas-bobinas/` | `/orcamento/chapas-bobinas/` |
| `apps/ace/` | `/orcamento/ace/` |
| `apps/blanks-slitters/` | `/orcamento/blanks-slitters/` |
| `apps/comparador-preco/` | `/comparador-preco/` |
| `apps/prospeccao/` | `/prospeccao/` |

## Home / login / auth

Fonte oficial: **`apps/root-index/`**.

Deploy: workflow da raiz do monorepo
[`.github/workflows/deploy-root-index.yml`](.github/workflows/deploy-root-index.yml)
(secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`).

Documentação: [`apps/root-index/AUTH.md`](apps/root-index/AUTH.md).
