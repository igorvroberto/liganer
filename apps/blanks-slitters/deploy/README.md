# Deploy — Orçamento blanks e slitters

Publicar em `https://vendas.liganer.com.br/orcamento/blanks-slitters/`.

## Secrets

| Secret | Valor |
| --- | --- |
| `FTP_SERVER` | `ftp.liganer.com.br` |
| `FTP_USERNAME` | `acesso@liganer.com.br` |
| `FTP_PASSWORD` | *(senha FTP — só no GitHub Secrets)* |

Destino fixo em `.github/workflows/deploy-blanks-slitters.yml`:
`/vendas.liganer.com.br/orcamento/blanks-slitters/`.

Auth e `api/budgets.php` vêm de `@liganer/shared` / `packages/shared/php/budgets.php`.
Docs auth: [`apps/root-index/AUTH.md`](../../root-index/AUTH.md).
