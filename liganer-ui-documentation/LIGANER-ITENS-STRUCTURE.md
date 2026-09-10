# Liganer Orçamento - Itens Section UI/UX Documentation

**URL:** http://vendas.liganer.com.br/orcamento/chapas-bobinas/  
**Date:** 2026-09-09  
**Purpose:** Complete structural documentation for replicating the Itens form model

---

## 1. Overall Page Layout

### Main Sections (Top to Bottom):
1. **Header Area**
   - Logo: "LIGANER - AÇO INOXIDÁVEL"
   - Title: "Orçamento comercial"
   - Help text: "Preencha por voz ou na tabela — diga o valor do campo atual, 'pular' para avançar, ou 'nova linha' para o próximo item."

2. **Customer Information**
   - Nome do cliente (text input)
   - CNPJ (text input)

3. **Material Navigation Section**
   - Orange button: "Ditar orçamento" (with microphone icon)
   - Navigation: "CAMPO ATUAL - ITEM X"
   - Title: "Material"
   - Arrow navigation: < >
   - Help text for voice commands

4. **Itens Section** (MAIN FOCUS)
   - Section header: "Itens"
   - Button: "+ Adicionar item" (orange button, top-right)
   - Horizontally scrollable table with many columns

5. **Totals Section**
   - Total (Kg): displays weight
   - Subtotal: monetary value
   - IPI 3,25%: tax value
   - Total: final monetary value
   - Frete: shipping percentage

6. **Payment Section (Pagamento)**
   - Orange button: "Ditar condições"
   - Section: "Condições"
   - Fields: Pagamento, Prazo de entrega, Local de expedição, Cidade do cliente, Tipo de frete, Observações gerais, Frete (%)

7. **Action Buttons**
   - Salvar (Save)
   - PDF cliente
   - PDF Liganer
   - Excel
   - CSV

---

## 2. Itens Table Structure

### Key Characteristics:
- **Each item = ONE ROW in a horizontally scrollable table**
- **ALL fields (material, specs, bobina/coil data, pricing) are IN THE SAME ROW**
- No separate sections for bobina or pricing - everything is inline in the row
- Delete button (X) on left side of each row
- Row number in "ITEM" column

### Complete Column List (40+ columns, left to right):

#### A. Item Identification
1. **[X]** - Delete button (red X icon)
2. **ITEM** - Row number (1, 2, 3...)

#### B. Material Specifications
3. **MATERIAL** - Dropdown selector
   - Options: BOBINA INTEIRA, BOBINA REDUZIDA, CHAPA
4. **TIPO** - Dropdown (empty/dash by default)
5. **ACABAMENTO** - Dropdown (empty/dash by default)
6. **PVC** - Dropdown
   - Options: NÃO, AZUL, PRETO E BRANCO, PRETO, NITTO FIBER
7. **ESPESSURA** - Dropdown (empty/dash by default)
8. **LARGURA** - Dropdown (empty/dash by default)
9. **COMPRIMENTO** - Dropdown (empty/dash by default)

#### C. Quantity & Weight
10. **QUANTIDADE** - Number input (shows "0" for items)
11. **PESO UNITÁRIO** - Number input (shows "0")
12. **PESO TOTAL** - Calculated/Display field (shows "0")

#### D. Base Pricing
13. **PREÇO SEM IPI** - Currency field (R$ 0,00)
14. **ICMS** - Percentage (0%)

#### E. Calculated Totals (First Set)
15. **SUBTOTAL** - Currency (R$ 0,00)
16. **OBSERVAÇÃO** - Text/input field
17. **PREÇO FATOR 100** - Currency (R$ 0,00)

#### F. Slitter/Processing Factors
18. **FATOR MÁXIMO** - Number input
19. **FATOR UTILIZADO** - Number input
20. **PREÇO FATOR UTILIZADO** - Currency (R$ 0,00)

#### G. Commission & Services
21. **COMISSÃO** - Dropdown (empty/dash by default)
22. **PREÇO SERVIÇO** - Text/number input
23. **DESCRIÇÃO SERVIÇO** - Text input

#### H. Final Pricing
24. **PREÇO TOTAL** - Currency (R$ 0,00)

#### I. Treatment Checkboxes (Material Treatments)
25. **ACE MTS** - Checkbox
26. **ACE MTO** - Checkbox
27. **FIL IND MTS** - Checkbox
28. **FIL IND MTO** - Checkbox
29. **AÇOS PRIME MTS** - Checkbox
30. **AÇOS PRIME MTO** - Checkbox

#### J. Additional Codes/Classifications
31. **IMG MTS** - Checkbox
32. **IMG MTO** - Checkbox
33. **CSA MTS** - Checkbox
34. **CSA MTO** - Checkbox
35. **TEITO MTS** - Checkbox
36. **TEITO MTO** - Checkbox

*Note: There may be 1-2 more columns at the very end that weren't fully visible*

---

## 3. Coil/Bobina vs Chapa - NO SEPARATE SECTIONS

### Critical Finding: **All fields are INSIDE the item row**

Unlike a potential assumption that bobina fields might be in a separate section:
- When you select "BOBINA INTEIRA" or "BOBINA REDUZIDA" or "CHAPA" from the MATERIAL dropdown
- The SAME column structure remains
- All columns stay visible in the same row
- No additional fields appear outside the table
- No separate "Bobina section" or "Formação de preço" section per item

**Material Type Behavior:**
- **CHAPA** (Sheet/Plate): Standard configuration, QUANTIDADE shows values
- **BOBINA INTEIRA** (Whole Coil): Same row structure, QUANTIDADE field behavior may differ
- **BOBINA REDUZIDA** (Reduced Coil/Slitter): Same row structure, likely enables slitter-related fields

The entire pricing calculation (base price, factors, services, total) is self-contained within each row.

---

## 4. Product Type Distinctions

### Material Types (from MATERIAL dropdown):
1. **CHAPA** - Sheet/Plate material
2. **BOBINA INTEIRA** - Whole coil
3. **BOBINA REDUZIDA** - Reduced coil (slitter processing)

### No "Blank" vs "Slitter" Toggle
- The distinction is handled through the MATERIAL dropdown selection
- When BOBINA REDUZIDA is selected, the slitter-related columns (FATOR MÁXIMO, FATOR UTILIZADO, PREÇO FATOR UTILIZADO) become relevant
- For CHAPA, these slitter fields exist but may remain unused (value 0 or empty)

---

## 5. Notes, Help Text, and Buttons

### Help Text:
- **Voice Command Instructions:** "Dicas: '304', 'tipo 430', 'pular', 'nova linha'. Funciona melhor no Chrome/Edge com microfone liberado."
- Located below the "Ditar orçamento" button

### Primary Button:
- **"+ Adicionar item"** (Add Item)
  - Orange/coral color
  - Located top-right of Itens section
  - Adds a new row to the table
  - Auto-increments item number
  - Updates "CAMPO ATUAL - ITEM X" indicator

### Item Actions:
- **Delete (X)**: Red X button on left of each row, deletes that item

### Voice/Dictation Features:
- "Ditar orçamento" button for voice input
- "Ditar condições" button for payment terms
- Microphone icon indicators

### No Visible Notes/Tooltips:
- No apparent help icons or tooltips on individual columns
- OBSERVAÇÃO column provides space for item-level notes

---

## 6. Screenshot Reference

The following screenshots are included in this documentation folder:

1. **01-full-page-initial.webp** - Complete first viewport showing header, customer info, Material section, and start of Itens table
2. **02-itens-table-with-two-rows.webp** - Itens table showing two items (CHAPA and BOBINA INTEIRA) with first columns visible
3. **03-material-dropdown-options.webp** - MATERIAL dropdown expanded showing: BOBINA INTEIRA, BOBINA REDUZIDA, CHAPA
4. **04-pvc-dropdown-options.webp** - PVC dropdown expanded showing: NÃO, AZUL, PRETO E BRANCO, PRETO, NITTO FIBER
5. **05-itens-middle-columns.webp** - Middle section of table showing ESPESSURA through PREÇO FATOR 100
6. **06-itens-pricing-columns.webp** - Pricing section showing PREÇO SEM IPI, ICMS, SUBTOTAL, OBSERVAÇÃO, PREÇO FATOR, etc.
7. **07-itens-checkbox-columns.webp** - Right section showing treatment checkboxes (ACE MTS, FIL IND MTO, etc.)
8. **08-totals-and-payment-section.webp** - Totals summary and Payment/Condições section below Itens table

---

## 7. React Implementation Guidance

### Recommended Data Model

```typescript
interface Item {
  id: number;
  material: 'CHAPA' | 'BOBINA_INTEIRA' | 'BOBINA_REDUZIDA' | '';
  tipo: string;
  acabamento: string;
  pvc: 'NÃO' | 'AZUL' | 'PRETO E BRANCO' | 'PRETO' | 'NITTO FIBER' | '';
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: number;
  pesoUnitario: number;
  pesoTotal: number; // calculated
  precoSemIPI: number;
  icms: number; // percentage
  subtotal: number; // calculated
  observacao: string;
  precoFator100: number;
  fatorMaximo: number;
  fatorUtilizado: number;
  precoFatorUtilizado: number; // calculated
  comissao: string;
  precoServico: number;
  descricaoServico: string;
  precoTotal: number; // calculated
  
  // Treatment checkboxes
  aceMTS: boolean;
  aceMTO: boolean;
  filIndMTS: boolean;
  filIndMTO: boolean;
  acosPrimeMTS: boolean;
  acosPrimeMTO: boolean;
  imgMTS: boolean;
  imgMTO: boolean;
  csaMTS: boolean;
  csaMTO: boolean;
  teitoMTS: boolean;
  teitoMTO: boolean;
}

interface Orcamento {
  cliente: string;
  cnpj: string;
  itens: Item[];
  totalKg: number; // calculated from all items
  subtotal: number; // calculated
  ipi: number; // 3.25% of subtotal
  total: number; // calculated
  frete: number; // percentage
  
  // Payment conditions
  pagamento: string;
  prazoEntrega: string;
  localExpedicao: string;
  cidadeCliente: string;
  tipoFrete: string;
  observacoesGerais: string;
}
```

### UI Component Structure

```
<OrcamentoForm>
  <CustomerInfo />
  <MaterialNavigation currentItem={activeItem} />
  
  <ItensSection>
    <ItensHeader>
      <h3>Itens</h3>
      <Button onClick={addItem}>+ Adicionar item</Button>
    </ItensHeader>
    
    <HorizontalScrollTable>
      {itens.map(item => (
        <ItemRow key={item.id} item={item}>
          <DeleteButton />
          <ItemNumber />
          <MaterialDropdown />
          <TipoDropdown />
          {/* ... all 40+ columns inline ... */}
          <CheckboxGroup /> {/* Treatment checkboxes */}
        </ItemRow>
      ))}
    </HorizontalScrollTable>
  </ItensSection>
  
  <TotalsSection />
  <PaymentSection />
  <ActionButtons />
</OrcamentoForm>
```

### Key Implementation Notes:

1. **Horizontal Scrolling**: Use `overflow-x: auto` on table container, fixed header row
2. **Wide Table**: Minimum ~3000-4000px width to accommodate all columns
3. **Responsive Column Widths**: 
   - Narrow: Item number, checkboxes (30-40px)
   - Medium: Dropdowns (100-150px)
   - Wide: Text inputs, observations (150-200px)
   - Currency: Right-aligned (100px)
4. **Calculated Fields**: Auto-calculate pesoTotal, subtotal, precoFatorUtilizado, precoTotal on input changes
5. **Conditional Logic**: 
   - Enable/highlight slitter fields (fatorMaximo, fatorUtilizado) when material is BOBINA_REDUZIDA
   - May need different quantidade behavior for BOBINA_INTEIRA
6. **Delete Confirmation**: Consider confirming before deleting an item row
7. **Item Counter**: Update "CAMPO ATUAL - ITEM X" in Material section when navigating/adding items
8. **Sticky Elements**: Consider sticky header row and first column (item number) for better UX

---

## Summary

The Liganer Itens section is a **single comprehensive table** where each row represents one complete item with all its specifications, coil/processing parameters, pricing calculations, and treatment options. There are NO separate sections for bobina fields or pricing - everything is inline within the row. The material type (CHAPA, BOBINA INTEIRA, BOBINA REDUZIDA) is selected via dropdown in the MATERIAL column, and this determines which fields in that row are relevant for the user to fill.

The form emphasizes voice/dictation input with visual indicators and navigation helpers, though it functions perfectly as a traditional form as well.
