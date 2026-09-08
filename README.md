# Radar Comercial B2B — Aço & Metalurgia (Liganer Prospecção)

Ferramenta de **prospecção comercial qualificada** para representante do setor siderúrgico/metalúrgico.

## Começar por aqui

1. Abrir [`radar-comercial/RADAR-ARACATUBA.md`](./radar-comercial/RADAR-ARACATUBA.md) — painel + TOP 20 + rotas  
2. Abrir [`radar-comercial/LEADS.csv`](./radar-comercial/LEADS.csv) no Excel/Sheets — CRM completo  

## Escopo v1

- **Cidade-base:** Araçatuba/SP  
- **Raio inicial:** Birigui, Penápolis, Andradina (+ inteligência de obras)  
- **5 funis:** Construção (C) · Corte e Dobra (CD) · Metalúrgica (M) · Indústria/Inox (I) · Distribuição (R)  

## O que esta base NÃO é

Lista genérica de empresas. Cada lead precisa responder: por que é prospect, qual produto do catálogo, por que compra.

## Atualizar a base

Editar leads em `radar-comercial/gerar_base.py` e regenerar:

```bash
cd radar-comercial && python3 gerar_base.py
```

## Legenda rápida

| Potencial | Significado |
| --------- | ----------- |
| A | Alta prioridade |
| B | Média |
| C | Baixa |
| X | Concorrente |
| P | Parceiro (quando aplicável) |

| Classificação comercial | Significado |
| ----------------------- | ----------- |
| PROSPECT | Atacar |
| CONCORRENTE | Fora da rota normal |
| PARCEIRO | Indicações |
| INDEFINIDO | Qualificar antes |
