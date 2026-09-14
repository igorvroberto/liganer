import * as XLSX from "xlsx";
import { blankSpecCitationLine } from "./materialGroups";
import { itemCommercial, parseFretePercent, type QuoteConditions } from "./quoteSummary";
import type { BlankInput } from "./types";
import { itemKindOf, pvcLabel } from "./types";

function itemExportRows(items: BlankInput[], freteRaw: string) {
  const freteFraction = parseFretePercent(freteRaw);
  return items.map((item, index) => {
    const commercial = itemCommercial(item, null, freteFraction);
    return {
      Item: index + 1,
      Material: itemKindOf(item) === "slitter" ? "SLITTER" : itemKindOf(item) === "blank" ? "BLANK" : "",
      Spec: blankSpecCitationLine(item),
      Tipo: item.tipo ?? "",
      Acabamento: item.acabamento ?? "",
      PVC: item.pvc ? pvcLabel(item.pvc) : "",
      Espessura: item.thickness ?? "",
      Largura: item.width || "",
      Comprimento: item.length || "",
      Quantidade: item.minQty || "",
      "Peso total": item.minKg || "",
      "Preço sem IPI": commercial.priceWithoutIpi ?? "",
      ICMS: commercial.icms ?? "",
      Subtotal: commercial.subtotal ?? "",
      Observação: item.observation ?? "",
      "Preço fator 100": item.priceFactor100 ?? "",
      "Fator": item.usedFactor ?? "",
      "Preço fator utilizado": commercial.usedPrice ?? "",
      Comissão: item.commission ?? "",
      "Preço serviço": item.servicePrice ?? "",
      "Descrição serviço": item.serviceDescription ?? "",
      "Preço total": commercial.totalPrice ?? "",
    };
  });
}

/** Exporta itens + condições em .xlsx */
export function downloadItemsExcel(
  items: BlankInput[],
  conditions: QuoteConditions,
  options?: { number?: string },
): void {
  const rows = itemExportRows(items, conditions.frete);
  const condRows = Object.entries(conditions).map(([k, v]) => ({ Campo: k, Valor: v }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Itens");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(condRows), "Condicoes");
  const number = String(options?.number ?? "").trim();
  const stamp = number || new Date().toISOString().slice(0, 10);
  XLSX.writeFile(book, `liganer-blanks-slitters-${stamp}.xlsx`);
}
