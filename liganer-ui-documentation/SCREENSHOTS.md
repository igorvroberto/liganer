# Screenshot Reference Guide

All screenshots are in WebP format and located in `/workspace/liganer-ui-documentation/`

---

## Screenshot Overview

### 01-full-page-initial.webp (45KB)
**What it shows:**
- Complete first viewport
- LIGANER logo and "Orçamento comercial" title
- Customer info fields (Nome do cliente, CNPJ)
- Material navigation section with "Ditar orçamento" button
- "CAMPO ATUAL - ITEM 1" indicator
- Start of Itens table with first 10 columns visible
- One item row (CHAPA type)
- Totals section at bottom

**Key elements visible:**
- Page header
- Voice dictation button
- "+ Adicionar item" button
- First columns: ITEM, MATERIAL, TIPO, ACABAMENTO, PVC, ESPESSURA, LARGURA, COMPRIMENTO, QUANTIDADE, PESO UNITÁRIO

---

### 02-itens-table-with-two-rows.webp (47KB)
**What it shows:**
- Two item rows for comparison
- Row 1: CHAPA (sheet) type
- Row 2: BOBINA INTEIRA (whole coil) type
- First 10-11 columns visible
- Shows how different material types appear in same table structure

**Key elements visible:**
- Delete buttons (X) for both rows
- Item numbers (1, 2)
- Material type dropdown selections
- QUANTIDADE field showing "0" for both items
- Demonstrates that structure doesn't change based on material type

---

### 03-material-dropdown-options.webp (47KB)
**What it shows:**
- MATERIAL dropdown menu expanded
- All three material type options visible

**Options shown:**
1. BOBINA INTEIRA
2. BOBINA REDUZIDA
3. CHAPA (selected/highlighted)

**Key insight:** Only three material types available, no other variations

---

### 04-pvc-dropdown-options.webp (47KB)
**What it shows:**
- PVC dropdown menu expanded
- All PVC coating options visible

**Options shown:**
1. NÃO (selected)
2. AZUL
3. PRETO E BRANCO
4. PRETO
5. NITTO FIBER

**Key insight:** 5 PVC options including "NÃO" (no coating)

---

### 05-itens-middle-columns.webp (46KB)
**What it shows:**
- Table scrolled to middle section
- Both item rows visible
- Columns from ESPESSURA through PREÇO FATOR 100

**Columns visible:**
- ESPESSURA (dropdown)
- LARGURA (dropdown)
- COMPRIMENTO (dropdown)
- QUANTIDADE (0)
- PESO UNITÁRIO (0)
- PESO TOTAL (0)
- PREÇO SEM IPI (R$ 0,00)
- ICMS (0%)
- SUBTOTAL (R$ 0,00)
- OBSERVAÇÃO (empty)
- PREÇO FATOR 100 (R$ 0,00)

---

### 06-itens-pricing-columns.webp (46KB)
**What it shows:**
- Table scrolled to pricing section
- Service and factor columns

**Columns visible:**
- PREÇO SEM IPI (R$ 0,00)
- ICMS (0%)
- SUBTOTAL (R$ 0,00)
- OBSERVAÇÃO
- PREÇO FATOR 100 (R$ 0,00)
- FATOR MÁXIMO (empty input)
- FATOR UTILIZADO (empty input)
- PREÇO FATOR UTILIZADO (R$ 0,00)
- COMISSÃO (dropdown)
- PREÇO SERVIÇO (input)
- DESCRIÇÃO SERVIÇO (input)
- PREÇO TOTAL (R$ 0,00)

**Key insight:** All pricing and slitter fields are inline in the row

---

### 07-itens-checkbox-columns.webp (46KB)
**What it shows:**
- Table scrolled to far right
- Treatment checkbox columns

**Columns visible:**
- XIMO (partial, from previous column)
- FATOR UTILIZADO
- PREÇO FATOR UTILIZADO (R$ 0,00)
- COMISSÃO (dropdown)
- PREÇO SERVIÇO
- DESCRIÇÃO SERVIÇO
- PREÇO TOTAL (R$ 0,00)
- ACE MTS (checkbox)
- ACE MTO (checkbox)
- FIL IND MTS (checkbox)
- FIL IND MTO (checkbox)
- AÇOS PRIME MTS (checkbox)
- AÇOS PRIME MTO (checkbox)
- IMG MTS (checkbox)
- IMG MTO (checkbox)

**Key insight:** 12+ treatment checkboxes at the end of each row

---

### 08-totals-and-payment-section.webp (39KB)
**What it shows:**
- Bottom portion of page
- End of Itens table (scrolled left, first columns visible)
- Complete Totals section
- Complete Pagamento (Payment) section with Condições

**Totals section shows:**
- Total (Kg): 0 Kg
- Subtotal: R$ 0,00
- IPI 3,25%: R$ 0,00
- Total: R$ 0,00
- Frete: 0,00%

**Pagamento section shows:**
- "Ditar condições" button (orange)
- Condições subsection with fields:
  - Pagamento
  - Prazo de entrega
  - Local de expedição (dropdown: "Selecionar...")
  - Cidade do cliente
  - Tipo de frete (dropdown: "Selecionar...")
  - Observações gerais (text area)
  - Frete (%) input

**Action buttons shown:**
- Salvar (dark button)
- PDF cliente
- PDF Liganer
- Excel
- CSV

---

## How to Use These Screenshots

### For Visual Reference:
1. Start with **01** to see the full page layout
2. Use **02** to understand multi-item structure
3. Reference **03-04** for dropdown options
4. Use **05-07** to see all table columns by section
5. Check **08** for totals and payment sections

### For Implementation:
- **Column Order:** Follow screenshots 01 → 05 → 06 → 07 (left to right)
- **Field Types:** Screenshots show input types (dropdown vs text vs number vs currency)
- **Spacing:** Use as reference for column widths and padding
- **Colors:** Note the orange buttons, blue text, light gray backgrounds

### For Validation:
- Compare your implementation to screenshots
- Verify all columns are present
- Check that dropdown options match
- Ensure button placement matches

---

## Navigation Through Screenshots

```
[Full Page]          [Table Detail]                    [Bottom Sections]
    01      →    02 → 05 → 06 → 07 (horizontal)    →        08
                      ↓
              [Dropdown Details]
                  03, 04
```

---

## Quick Column Reference by Screenshot

| Screenshot | Columns Shown | Column Range |
|-----------|---------------|--------------|
| 01, 02 | ITEM → PESO UNITÁRIO | Columns 1-11 |
| 05 | ESPESSURA → PREÇO FATOR 100 | Columns 7-17 |
| 06 | PREÇO SEM IPI → PREÇO TOTAL | Columns 13-24 |
| 07 | PREÇO FATOR UTILIZADO → IMG MTO | Columns 20-32 |

*(Approximate ranges, some overlap for context)*

---

*All screenshots taken September 9, 2026 from http://vendas.liganer.com.br/orcamento/chapas-bobinas/*
