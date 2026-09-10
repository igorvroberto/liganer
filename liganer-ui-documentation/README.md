# Liganer Orçamento UI/UX Documentation

This directory contains a complete structural analysis of the Liganer "Orçamento comercial" form, specifically the **Itens section**, for replication in another calculator application.

## Quick Links

- **Main Documentation**: [LIGANER-ITENS-STRUCTURE.md](LIGANER-ITENS-STRUCTURE.md) - Complete structural breakdown
- **Source URL**: http://vendas.liganer.com.br/orcamento/chapas-bobinas/
- **Date Documented**: September 9, 2026

## Key Findings

### 🔑 Critical Structure Insight
**All item fields are in a SINGLE ROW** in the Itens table. There are NO separate sections for:
- Bobina (coil) specifications
- Formação de preço (pricing formation)
- Treatment options

Everything is inline in one horizontally-scrollable table row per item.

### 📊 Table Specifications
- **40+ columns** per row
- **Horizontally scrollable** design
- **Three material types**: CHAPA, BOBINA INTEIRA, BOBINA REDUZIDA
- **Column categories**:
  1. Item identification (delete, number)
  2. Material specifications (7 dropdowns)
  3. Quantity & weight (3 fields)
  4. Base pricing (2 fields)
  5. Calculated totals (3 fields)
  6. Slitter/processing factors (3 fields)
  7. Commission & services (3 fields)
  8. Final pricing (1 field)
  9. Treatment checkboxes (12+ checkboxes)

### 🎨 Design Elements
- Orange/coral action buttons
- Voice dictation features
- Navigation indicators
- Separate Totals section below table
- Payment/Conditions section at bottom

## Screenshots Included

| File | Description |
|------|-------------|
| `01-full-page-initial.webp` | Complete first viewport |
| `02-itens-table-with-two-rows.webp` | Table with CHAPA and BOBINA INTEIRA examples |
| `03-material-dropdown-options.webp` | MATERIAL dropdown expanded |
| `04-pvc-dropdown-options.webp` | PVC dropdown expanded |
| `05-itens-middle-columns.webp` | Middle columns (ESPESSURA → PREÇO FATOR 100) |
| `06-itens-pricing-columns.webp` | Pricing columns visible |
| `07-itens-checkbox-columns.webp` | Treatment checkboxes section |
| `08-totals-and-payment-section.webp` | Totals and Payment sections |

## For Developers

See the main documentation for:
- Complete column list with field types
- TypeScript interface definitions
- React component structure recommendations
- Implementation notes and best practices

## Usage

Read `LIGANER-ITENS-STRUCTURE.md` for the full analysis, and reference the screenshots to understand the visual layout and field organization.
