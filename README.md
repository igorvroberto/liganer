# Calculadora de aproveitamento de blanks e slitters

Sistema Liganer para calcular o **melhor aproveitamento de corte** em aço inoxidável a partir da largura original da bobina.

O material de cada linha pode ser **BLANK** ou **SLITTER** (definido no item 1 e obrigatório para os demais — sem misturar).

O cálculo considera:

- largura e comprimento de cada item (BLANK com giro 90° automático; SLITTER sem giro)
- peso mínimo em kg (pode ultrapassar um pouco, nunca fica abaixo) — ou peso máximo, se a opção de ultrapassar estiver desligada
- quantidade mínima em unidades
- largura original da bobina
- espessura (2 casas decimais), densidade fixa de 8 g/cm³ e refile de borda
- **um ou vários programas de corte** — setups diferentes na largura, executados em sequência ao longo do comprimento da bobina
- **relatório em PDF** do plano selecionado (bobina, programas, peças e pesos)
- tabela de preços (tipo, acabamento, PVC, espessura) para preço fator 100

## Exemplo

Itens **600 × 470 mm** e **650 × 500 mm**, **1.000 kg de cada**, bobina de **1.250 mm**.

O plano recomendado usa as tiras **600 + 650 mm**, que fecham a largura da bobina com aproveitamento próximo de 100%.

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

## Orçamentos salvos

- O botão **PDF cliente** salva o orçamento (localStorage) e abre o PDF com o número `AAMMDD##`.
- Com `config.json` no host (`saveUrl` + `syncSecret`), também sincroniza via `api/budgets.php`.
- Use `public/config.example.json` como modelo; **não** versionar o `config.json` real nem a pasta `data/`.
- PDF Liganer / gestão não salvam orçamento.

Peso da peça (kg):

`largura(mm) × comprimento(mm) × espessura(mm) × densidade(g/cm³) / 1.000.000`

Densidade usada no cálculo: **8 g/cm³**.
