# Calculadora de aproveitamento de blanks

Sistema Liganer para calcular o **melhor aproveitamento de corte de blanks em aço inoxidável** a partir da largura original da bobina.

O cálculo considera:

- largura e comprimento de cada blank (com giro 90° automático)
- peso mínimo em kg (pode ultrapassar um pouco, nunca fica abaixo)
- quantidade mínima em unidades
- largura original da bobina
- espessura, liga/densidade, perda de faca e refile de borda

## Exemplo

Blanks **600 × 470 mm** e **650 × 500 mm**, **1.000 kg de cada**, bobina de **1.250 mm**.

O plano recomendado usa as tiras **600 + 650 mm**, que fecham a largura da bobina com aproveitamento próximo de 100%. O blank mais estreito precisa de um pouco mais de comprimento de bobina para chegar a 1.000 kg; o outro sai um pouco acima disso.

## Como usar

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

Testes do motor de corte:

```bash
npm test
```

Peso da peça (kg):

`largura(mm) × comprimento(mm) × espessura(mm) × densidade(g/cm³) / 1.000.000`

Densidades padrão: AISI 304 = 7,93 · 316 = 8,00 · 430 = 7,70 · 201 = 7,80.
