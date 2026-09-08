# Liganer Prospecção

Radar comercial B2B + sistema em **`vendas.liganer.com.br/prospeccao`**.

## Fonte dos leads

[`radar-comercial/LEADS.csv`](./radar-comercial/LEADS.csv) no GitHub.

## Deploy automático (FTP)

Configure os secrets `FTP_*` neste repo (veja [`deploy/README.md`](./deploy/README.md)).

Qualquer merge na `main` que altere leads ou o app → **Actions publica tudo via FTP**.

## Sync automático (editar/remover no site)

Com `LEADS_SYNC_SECRET` + `LEADS_GITHUB_TOKEN` configurados, editar ou remover um lead no site:

1. Atualiza `data/leads.csv` na hospedagem na hora  
2. Faz commit de `radar-comercial/LEADS.csv` no GitHub  

Sem passo manual de baixar CSV. Detalhes em [`deploy/README.md`](./deploy/README.md).

## Dev local

```bash
bash scripts/sync-leads.sh
cd web && npm install && npm run dev
# http://localhost:5173/prospeccao/
```
