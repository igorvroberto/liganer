# Liganer Prospecção

Radar comercial B2B + sistema em **`vendas.liganer.com.br/prospeccao`**.

## Fonte dos leads

[`radar-comercial/LEADS.csv`](./radar-comercial/LEADS.csv) no GitHub.

## Deploy automático (FTP)

Configure os secrets `FTP_*` neste repo (veja [`deploy/README.md`](./deploy/README.md)).

Qualquer merge na `main` que altere leads ou o app → **Actions publica tudo via FTP**.

## Dev local

```bash
bash scripts/sync-leads.sh
cd web && npm install && npm run dev
# http://localhost:5173/prospeccao/
```
