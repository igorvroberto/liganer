# Liganer Prospecção

Radar comercial B2B (aço/metalurgia) + sistema web em **`vendas.liganer.com.br/prospeccao`**.

## Abrir a base (planilha)

- [`radar-comercial/LEADS.csv`](./radar-comercial/LEADS.csv) — **fonte da verdade (GitHub)**
- Painel texto: [`radar-comercial/RADAR-ARACATUBA.md`](./radar-comercial/RADAR-ARACATUBA.md)

## Sistema web

```bash
bash scripts/sync-leads.sh
cd web && npm install && npm run dev
# http://localhost:5173/prospeccao/
```

## Publicar (FTP)

1. `cd web && npm run build`
2. Enviar `web/dist/` via FileZilla para `/prospeccao/`
3. Configurar secrets `FTP_*` para o Action espelhar o CSV automaticamente

Detalhes: [`deploy/README.md`](./deploy/README.md)

## Atualizar leads

Edite no GitHub → merge `main` → Action FTP atualiza `data/leads.csv` → no site clique **Atualizar**.
