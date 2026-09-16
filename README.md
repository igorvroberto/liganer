# Liganer · Comparador de preço

App interno para comparar nosso preço com o do concorrente, com ajuste de ICMS e
PIS/COFINS — mesma lógica da planilha **Diferença preço e ICMS**.

Destino de publicação: **https://vendas.liganer.com.br/comparador-preco/**

Visual e stack alinhados ao orçamento de chapas/bobinas:
https://vendas.liganer.com.br/orcamento/chapas-bobinas/

## Stack

- Vite + React + TypeScript
- Base path `/comparador-preco/`
- Persistência local (`localStorage`)
- Exportação Excel / CSV (`xlsx`)

## Desenvolvimento

```bash
npm install
npm run dev
```

O Vite serve em `http://localhost:5173/comparador-preco/`.

## Scripts

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run lint` | Oxlint |
| `npm test` | Testes Vitest (fórmulas da planilha) |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |

## Fórmulas (aba Diferença)

Com `PIS+COFINS` global (padrão `9,25%`):

- **Nosso preço** = Preço fator 100 ÷ Fator utilizado × 100
- **Origem** = 1 − (PIS+COFINS + Nosso ICMS)
- **Destino** = 1 − (PIS+COFINS + ICMS cliente)
- **Preço equivalente** = Nosso preço × Origem ÷ Destino
- **Diferença preço** = Preço equivalente ÷ Preço cliente − 1
- **Preço alvo** = Nosso preço × Preço cliente ÷ Preço equivalente
- **Fator-alvo** = Preço fator 100 ÷ Preço alvo × 100

## Deploy

Ver [deploy/README.md](deploy/README.md).
