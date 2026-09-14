# Liganer · Orçamento

App interno de orçamento comercial da Liganer, no mesmo padrão dos sistemas em:

- https://vendas.liganer.com.br/orcamento/blanks-slitters/
- https://vendas.liganer.com.br/prospeccao/

Destino de publicação: **https://vendas.liganer.com.br/orcamento/ace/**

## Stack

- Vite + React + TypeScript
- Base path `/orcamento/ace/`
- Cálculos e modelos portados do plugin WordPress legado (`legado/`)
- Persistência local (`localStorage`) + API PHP opcional (`deploy/api/budgets.php`)

## Desenvolvimento

```bash
npm install
npm run dev
```

Em dev o Vite serve em `/orcamento/ace/` (veja `vite.config.ts`).

## Build

```bash
npm run build
npm run preview
```

O `prebuild` regenera o JSON de fallback a partir da planilha compartilhada
(`/orcamento/tabelas/precos-chapas-bobinas.xlsx`). Em produção o app lê esse Excel
direto no host (fora da pasta deste app), para outros repositórios usarem a mesma fonte.

## Atualizar preços

1. Substitua no HostGator: `/vendas.liganer.com.br/orcamento/tabelas/precos-chapas-bobinas.xlsx`
2. Hard-refresh no navegador — sem rebuild. (Opcional: `npm run sync:prices` para atualizar o JSON de fallback no repo.)

As opções de **Tipo**, **Acabamento**, **PVC** e **Espessura** também vêm dessa planilha.
Acabamento é filtrado pelo tipo; espessura pelo par tipo+acabamento (como em blanks-slitters).

## Funcionalidades

- Orçamento de tubos e barras (persistência/PDF/lista no padrão chapas-bobinas)
- Cliente (nome / CNPJ), itens, condições (pagamento, frete CIF/FOB, expedição SP/CE…)
- Preço fator 100 e ICMS pela planilha Excel
- Peso, fator utilizado, frete %, IPI 3,25%
- Ditado por voz (Web Speech API)
- Exportação: PDF cliente, PDF Liganer, Excel, CSV
- PDF cliente salva o orçamento (nome = número; localStorage + API com `syncSecret`)

## Deploy

Ver [deploy/README.md](deploy/README.md).

## Legado

A pasta `legado/` guarda o plugin WordPress original (`orcamento-liganer`) que hoje roda em https://liganer.com.br/orcamento-liganer/ — referência das regras de negócio.

## Fluxo de contribuição

Alterações entram via **pull request** (sem push direto na `main` pelo agent).
