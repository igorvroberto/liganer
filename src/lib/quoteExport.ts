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
      "Fator utilizado": item.usedFactor ?? "",
      "Preço fator utilizado": commercial.usedPrice ?? "",
      Comissão: item.commission ?? "",
      "Preço serviço": item.servicePrice ?? "",
      "Descrição serviço": item.serviceDescription ?? "",
      "Preço total": commercial.totalPrice ?? "",
    };
  });
}

export function downloadItemsCsv(items: BlankInput[], conditions: QuoteConditions): void {
  const rows = itemExportRows(items, conditions.frete);
  const condRows = Object.entries(conditions).map(([k, v]) => ({ Campo: k, Valor: v }));
  const sheetItems = XLSX.utils.json_to_sheet(rows);
  const sheetCond = XLSX.utils.json_to_sheet(condRows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheetItems, "Itens");
  XLSX.utils.book_append_sheet(book, sheetCond, "Condicoes");
  const csv = XLSX.utils.sheet_to_csv(sheetItems);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `liganer-blanks-slitters-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadItemsExcel(items: BlankInput[], conditions: QuoteConditions): void {
  const rows = itemExportRows(items, conditions.frete);
  const condRows = Object.entries(conditions).map(([k, v]) => ({ Campo: k, Valor: v }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Itens");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(condRows), "Condicoes");
  XLSX.writeFile(book, `liganer-blanks-slitters-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
