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

O `prebuild` regenera o JSON de fallback a partir da planilha ACE
(`/orcamento/tabelas/precos-ace.xlsx`). Em produção o app lê esse Excel
direto no host (fora da pasta deste app).

## Atualizar preços

1. Substitua no HostGator: `/vendas.liganer.com.br/orcamento/tabelas/precos-ace.xlsx`
2. Hard-refresh no navegador — sem rebuild. (Opcional: `npm run sync:prices` para atualizar o JSON de fallback no repo.)

O material é pesquisável a partir da descrição dessa planilha (orientação de colunas em evolução).

## Funcionalidades

- Orçamento ACE (persistência/PDF/lista)
- Cliente (nome / CNPJ), itens, condições (pagamento, frete CIF/FOB, expedição SP/CE…)
- Material pesquisável + preço fator 100 pela planilha `precos-ace.xlsx`
- Fator utilizado, frete %, IPI 3,25%
- Exportação: PDF cliente, PDF Liganer, Excel
- PDF cliente salva o orçamento (nome = número; localStorage + API com `syncSecret`)

## Deploy

Ver [deploy/README.md](deploy/README.md).

## Legado

A pasta `legado/` guarda o plugin WordPress original (`orcamento-liganer`) que hoje roda em https://liganer.com.br/orcamento-liganer/ — referência das regras de negócio.

## Fluxo de contribuição

Alterações entram via **pull request** (sem push direto na `main` pelo agent).
