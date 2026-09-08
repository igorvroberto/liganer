# Liganer Prospecção

Radar comercial B2B (aço/metalurgia) + sistema web em **`vendas.liganer.com.br/prospeccao`**.

## Abrir a base (planilha)

- [`radar-comercial/LEADS.csv`](./radar-comercial/LEADS.csv)
- Painel texto: [`radar-comercial/RADAR-ARACATUBA.md`](./radar-comercial/RADAR-ARACATUBA.md)

## Sistema web (filtros + dossiê)

```bash
bash scripts/sync-leads.sh
cd web
npm install
npm run dev
# http://localhost:5173/prospeccao/
```

### Publicação

Push em `main` → GitHub Actions gera o site estático e (se secrets VPS_* estiverem configurados) faz deploy em `/prospeccao`.

Detalhes: [`deploy/README.md`](./deploy/README.md)

## Atualizar leads

1. Editar `radar-comercial/gerar_base.py` ou `LEADS.csv`
2. `python3 radar-comercial/gerar_base.py` (se usou o gerador)
3. Commit → merge `main` → site atualiza

A UI **não grava** alterações; a fonte da verdade é o GitHub.
