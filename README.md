# Calculadora de aproveitamento de blanks

Sistema Liganer para calcular o **melhor aproveitamento de corte de blanks em aço inoxidável** a partir da largura original da bobina.

O cálculo considera:

- largura e comprimento de cada blank (com giro 90° automático)
- peso mínimo em kg (pode ultrapassar um pouco, nunca fica abaixo) — ou peso máximo, se a opção de ultrapassar estiver desligada
- quantidade mínima em unidades
- largura original da bobina
- espessura (2 casas decimais), densidade fixa de 8 g/cm³, perda de faca e refile de borda
- **um ou vários programas de corte** — setups diferentes na largura, executados em sequência ao longo do comprimento da bobina
- **relatório em PDF** do plano selecionado (bobina, programas, peças e pesos)

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

Densidade usada no cálculo: **8 g/cm³**.
