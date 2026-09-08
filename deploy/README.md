# Deploy — vendas.liganer.com.br/prospeccao

O app em `web/` é um SPA estático. A fonte dos leads é `radar-comercial/LEADS.csv` no GitHub.

## Fluxo

```
editar LEADS.csv (ou gerar_base.py) → push main → GitHub Actions build → rsync VPS → /prospeccao
```

## 1. Build local

```bash
bash scripts/sync-leads.sh
cd web && npm ci && npm run build
# saída em web/dist — base path /prospeccao/
```

Preview local com o prefixo correto:

```bash
cd web && npm run preview -- --host
# abrir http://localhost:4173/prospeccao/
```

## 2. Nginx na VPS

1. Criar pasta: `/var/www/vendas.liganer.com.br/prospeccao`
2. Usar o exemplo `nginx-vendas.liganer.com.br.conf`
3. DNS `vendas.liganer.com.br` → IP da VPS
4. Certbot SSL
5. (Recomendado) `auth_basic` no `/prospeccao/`

## 3. Secrets do GitHub (deploy automático)

No repositório → Settings → Secrets and variables → Actions:

| Secret | Exemplo |
| ------ | ------- |
| `VPS_HOST` | IP ou hostname |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | chave privada SSH |
| `VPS_PATH` | `/var/www/vendas.liganer.com.br/prospeccao` (opcional) |
| `VPS_PORT` | `22` (opcional) |

Sem esses secrets, o workflow **só gera o artifact** `prospeccao-dist` (download manual).

## 4. Atualizar leads

1. Editar `radar-comercial/gerar_base.py` ou `LEADS.csv`
2. `python3 radar-comercial/gerar_base.py` (se usou o script)
3. Commit + merge em `main`
4. O Actions sincroniza o CSV para o build e publica

Edições feitas só na UI do navegador **não** persistem — a verdade é o GitHub.
