import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  fmtCurrency,
  fmtDecimal2,
  fmtInt,
  fmtKg,
  fmtMeters,
  fmtPlainInt,
  fmtPlainMm,
  fmtNumber,
  fmtPct,
  fmtThickness,
  formatLossInfoNote,
} from "./format";
import { blankSpecCitation, blankSpecCitationLine } from "./materialGroups";
import { blankUnitKg } from "./blankSync";
import {
  itemCommercial,
  parseFretePercent,
  QUOTE_CONDITION_FIELDS,
  type ItemLongitudinalLoss,
  type QuoteConditions,
  type QuoteSummary,
} from "./quoteSummary";
import {
  BLANK_COLORS,
  COMMISSION_OPTIONS,
  isSlitterItem,
  itemKindOf,
  MTO_FIELDS,
  pvcLabel,
  type BlankInput,
  type CoilInput,
  type RankedPlan,
} from "./types";
import { groupIdenticalStrips, lossBreakdown, productIndicesInProgram } from "./optimize";
import { coilForProgram } from "./slitterCoil";
import { registerPdfFonts } from "./pdfFonts";
import { localPrintNumber } from "./storage";

export type PdfVariant = "cliente" | "liganer" | "gestao";

export type QuotePdfInput = {
  variant: PdfVariant;
  items: BlankInput[];
  conditions: QuoteConditions;
  summary: QuoteSummary;
  lossByItemId?: Record<string, ItemLongitudinalLoss>;
  plan?: RankedPlan | null;
  coil?: CoilInput;
};

const BRAND: [number, number, number] = [198, 0, 0];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

function lastTableY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function dash(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

export function reportFileName(_variant?: PdfVariant, _plan?: RankedPlan | null): string {
  return `${localPrintNumber()}.pdf`;
}

function drawStripBar(
  doc: jsPDF,
  plan: RankedPlan,
  coilWidth: number,
  edgeTrim: number,
  programIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
  fontName: string,
) {
  const program = plan.programs[programIndex];
  const barW = width;
  const barX = x;
  const stripColor = (idx: number) => BLANK_COLORS[idx % BLANK_COLORS.length];

  const paint = (
    colorOf: (index: number) => string,
    labelOf: (strip: (typeof program.pattern.strips)[number]) => string,
    rowY: number,
  ) => {
    let cursor = barX;

    if (edgeTrim > 0) {
      const w = (edgeTrim / coilWidth) * barW;
      doc.setFillColor(180, 188, 196);
      doc.rect(cursor, rowY, w, height, "F");
      doc.setTextColor(70, 80, 88);
      doc.setFontSize(5.5);
      doc.setFont(fontName, "bold");
      if (w > 6) doc.text(`${fmtInt(edgeTrim)}`, cursor + w / 2, rowY + height / 2 + 1, { align: "center" });
      cursor += w;
    }

    for (const [idx, strip] of program.pattern.strips.entries()) {
      const w = (strip.stripWidth / coilWidth) * barW;
      const rgb = hexToRgb(colorOf(idx));
      doc.setFillColor(...rgb);
      doc.rect(cursor, rowY, w, height, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont(fontName, "bold");
      if (w > 14) {
        doc.text(labelOf(strip), cursor + w / 2, rowY + height / 2 + 1, { align: "center" });
      }
      cursor += w;
    }

    if (program.pattern.waste > 0.5) {
      const w = (program.pattern.waste / coilWidth) * barW;
      doc.setFillColor(210, 214, 218);
      doc.rect(cursor, rowY, Math.max(w, 0.8), height, "F");
      doc.setTextColor(70, 80, 88);
      doc.setFontSize(6.5);
      doc.setFont(fontName, "bold");
      const wasteLabel = `sobra ${fmtInt(program.pattern.waste)}`;
      const labelW = doc.getTextWidth(wasteLabel);
      if (w > labelW + 1.2) {
        doc.text(wasteLabel, cursor + w / 2, rowY + height / 2 + 1, { align: "center" });
      } else {
        doc.text(wasteLabel, cursor + Math.max(w, 0.8) + 1.4, rowY + height / 2 + 1, { align: "left" });
      }
      cursor += Math.max(w, 0.8);
    }

    if (edgeTrim > 0) {
      const w = (edgeTrim / coilWidth) * barW;
      doc.setFillColor(180, 188, 196);
      doc.rect(cursor, rowY, w, height, "F");
      doc.setTextColor(70, 80, 88);
      doc.setFontSize(5.5);
      doc.setFont(fontName, "bold");
      if (w > 6) doc.text(`${fmtInt(edgeTrim)}`, cursor + w / 2, rowY + height / 2 + 1, { align: "center" });
    }

    doc.setDrawColor(213, 221, 228);
    doc.rect(barX, rowY, barW, height, "S");
  };

  paint(stripColor, (strip) => fmtInt(strip.stripWidth), y);

  const usableWidth = coilWidth - 2 * edgeTrim;
  const usedWidth = program.pattern.strips.reduce((s, strip) => s + strip.stripWidth, 0);
  const blankScale = usedWidth > 0 ? usableWidth / usedWidth : 1;
  let cursor2 = barX;
  for (const [idx, strip] of program.pattern.strips.entries()) {
    const w = ((strip.stripWidth * blankScale) / coilWidth) * barW;
    const rgb = hexToRgb(stripColor(idx));
    doc.setFillColor(...rgb);
    doc.rect(cursor2, y + height + 2, w, height, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont(fontName, "bold");
    const label = `${fmtInt(strip.stripWidth)}×${fmtInt(strip.cutLength <= 1 + 1e-9 ? program.coilLengthMm : strip.cutLength)}`;
    if (w > doc.getTextWidth(label) + 2) {
      doc.text(label, cursor2 + w / 2, y + height + 2 + height / 2 + 1, { align: "center" });
    }
    cursor2 += w;
  }
  doc.setDrawColor(213, 221, 228);
  doc.rect(barX, y + height + 2, cursor2 - barX, height, "S");
  doc.setTextColor(27, 36, 44);
}

function appendBanner(
  doc: jsPDF,
  fontName: string,
  variant: PdfVariant,
  itemCount: number,
  pageW: number,
  margin: number,
): number {
  const subtitle =
    variant === "cliente"
      ? "Orçamento de blanks e slitters · Proposta comercial"
      : variant === "gestao"
        ? "Orçamento de blanks e slitters · Gestão"
        : "Orçamento de blanks e slitters · Uso interno Liganer";
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontName, "bold");
  doc.setFontSize(13);
  doc.text("Liganer", margin, 10);
  doc.setFont(fontName, "normal");
  doc.setFontSize(8);
  doc.text(subtitle, margin, 16);
  const generated = new Date().toLocaleString("pt-BR");
  doc.setFontSize(8);
  doc.text(generated, pageW - margin, 10, { align: "right" });
  doc.text(`${itemCount} item(ns)`, pageW - margin, 16, { align: "right" });
  return 28;
}

function appendItemsTable(
  doc: jsPDF,
  fontName: string,
  variant: PdfVariant,
  items: BlankInput[],
  lossByItemId: Record<string, ItemLongitudinalLoss>,
  coil: CoilInput | undefined,
  margin: number,
  y: number,
  freteFraction = 0,
): number {
  const internal = variant === "liganer" || variant === "gestao";
  const gestao = variant === "gestao";

  const headCliente = [
    "Item",
    "Tipo",
    "Acab.",
    "PVC",
    "Esp.",
    "Larg.",
    "Comp.",
    "Qtd",
    "Peso un.",
    "ICMS",
    "Preço sem IPI",
    "Subtotal",
    "Observação",
  ];

  const headLiganer = [
    "Item",
    "Bobina",
    "Material",
    "Tipo",
    "Acab.",
    "PVC",
    "Esp.",
    "Larg.",
    "Comp.",
    "Qtd",
    "Peso un.",
    "Peso total",
    "Preço sem IPI",
    "ICMS",
    "Subtotal",
    "Observação",
    "Fator 100",
    "Fator",
    "Preço fator util.",
    "Comissão",
    "Preço serviço",
    "Desc. serviço",
    "Sobra mm",
    "Sobra %",
    "Acréscimo sobra",
    "Preço total",
    ...MTO_FIELDS.map((f) => f.label.replace(/\n/g, " ")),
  ];

  const body = items.map((item, index) => {
    const loss = lossByItemId[item.id] ?? null;
    const commercial = itemCommercial(item, loss, freteFraction);
    const kind = itemKindOf(item);
    const unitKg = coil ? blankUnitKg(item, {
      ...coil,
      thickness: item.thickness && item.thickness > 0 ? item.thickness : coil.thickness,
      width: item.coilWidth && item.coilWidth > 0 ? item.coilWidth : coil.width,
    }) : 0;
    const material = kind === "slitter" ? "SLITTER" : kind === "blank" ? "BLANK" : "—";
    const commission =
      COMMISSION_OPTIONS.find((o) => o.value === item.commission)?.label ?? "—";

    if (!internal) {
      return [
        String(index + 1),
        dash(item.tipo),
        dash(item.acabamento),
        item.pvc ? pvcLabel(item.pvc) : "—",
        item.thickness != null ? fmtThickness(item.thickness) : "—",
        item.width > 0 ? fmtPlainInt(item.width) : "—",
        item.length > 0 ? fmtPlainInt(item.length) : "—",
        item.minQty > 0 ? fmtInt(item.minQty) : "—",
        unitKg > 0 ? fmtDecimal2(unitKg) : "—",
        commercial.icms != null ? `${fmtNumber(commercial.icms, 0)}%` : "—",
        commercial.priceWithoutIpi != null ? fmtCurrency(commercial.priceWithoutIpi) : "—",
        commercial.subtotal != null ? fmtCurrency(commercial.subtotal) : "—",
        dash(item.observation),
      ];
    }

    return [
      String(index + 1),
      item.coilWidth != null && item.coilWidth > 0 ? fmtPlainInt(item.coilWidth) : "—",
      material,
      dash(item.tipo),
      dash(item.acabamento),
      item.pvc ? pvcLabel(item.pvc) : "—",
      item.thickness != null ? fmtThickness(item.thickness) : "—",
      item.width > 0 ? fmtPlainInt(item.width) : "—",
      item.length > 0 ? fmtPlainInt(item.length) : "—",
      item.minQty > 0 ? fmtInt(item.minQty) : "—",
      unitKg > 0 ? fmtNumber(unitKg, 3) : "—",
      item.minKg > 0 ? fmtNumber(item.minKg, 1) : "—",
      commercial.priceWithoutIpi != null ? fmtCurrency(commercial.priceWithoutIpi) : "—",
      commercial.icms != null ? `${fmtNumber(commercial.icms, 0)}%` : "—",
      commercial.subtotal != null ? fmtCurrency(commercial.subtotal) : "—",
      dash(item.observation),
      item.priceFactor100 != null ? fmtCurrency(item.priceFactor100) : "—",
      item.usedFactor != null ? fmtNumber(item.usedFactor, 2) : "—",
      commercial.usedPrice != null ? fmtCurrency(commercial.usedPrice) : "—",
      commission,
      item.servicePrice != null ? fmtCurrency(item.servicePrice) : "—",
      dash(item.serviceDescription),
      commercial.perdaMm != null ? fmtInt(commercial.perdaMm) : "—",
      commercial.perdaPct != null ? fmtPct(commercial.perdaPct) : "—",
      commercial.acrescimoPerda != null ? fmtPct(commercial.acrescimoPerda) : "—",
      commercial.totalPrice != null ? fmtCurrency(commercial.totalPrice) : "—",
      ...MTO_FIELDS.map((f) => (item[f.key] ? "X" : "")),
    ];
  });

  const gestaoExcluded = new Set([
    "Observação",
    "Fator 100",
    "Comissão",
    ...MTO_FIELDS.map((f) => f.label.replace(/\n/g, " ")),
  ]);
  const headInternal = gestao
    ? headLiganer.filter((label) => !gestaoExcluded.has(label))
    : headLiganer;
  const bodyInternal = gestao
    ? body.map((row) => row.filter((_, idx) => !gestaoExcluded.has(headLiganer[idx])))
    : body;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [internal ? headInternal : headCliente],
    body: internal ? bodyInternal : body,
    tableWidth: "auto",
    headStyles: {
      font: fontName,
      fontStyle: "bold",
      fillColor: BRAND,
      textColor: 255,
      fontSize: internal ? 4.5 : 6.5,
      halign: "center",
    },
    bodyStyles: { font: fontName, fontSize: internal ? 4.8 : 7, halign: "center" },
    styles: {
      font: fontName,
      cellPadding: internal ? 0.8 : 1.2,
      overflow: "linebreak",
      cellWidth: "wrap",
    },
  });

  return lastTableY(doc) + 6;
}

function appendTotalsAndConditions(
  doc: jsPDF,
  fontName: string,
  summary: QuoteSummary,
  conditions: QuoteConditions,
  margin: number,
  contentW: number,
  y: number,
  variant: PdfVariant = "liganer",
): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + 50 > pageH - 14) {
    doc.addPage();
    y = 16;
  }

  doc.setFont(fontName, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND);
  doc.text("Totais", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { font: fontName, fontSize: 8, cellPadding: 2, halign: "center" },
    headStyles: { fillColor: [252, 232, 232], textColor: BRAND, fontStyle: "bold" },
    body: [
      ["Total (Kg)", `${fmtInt(summary.totalKg)} Kg`],
      ["Subtotal", fmtCurrency(summary.subtotal)],
      ["IPI 3,25%", fmtCurrency(summary.ipi)],
      ["Total", fmtCurrency(summary.total)],
    ],
    columnStyles: {
      0: { cellWidth: contentW / 2, fontStyle: "bold", textColor: [86, 99, 93] },
      1: { cellWidth: contentW / 2, fontStyle: "bold" },
    },
  });
  y = lastTableY(doc) + 8;

  const filled = QUOTE_CONDITION_FIELDS.filter((f) => {
    if (!String(conditions[f.key] ?? "").trim()) return false;
    if (variant === "cliente" && f.key === "frete") return false; // gestão/liganer mantêm frete
    return true;
  });

  if (filled.length === 0) {
    return y;
  }

  doc.setFont(fontName, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND);
  doc.text("Condições", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { font: fontName, fontSize: 8, cellPadding: 2 },
    body: filled.map((f) => [f.label, String(conditions[f.key])]),
    columnStyles: {
      0: { cellWidth: contentW / 2, fontStyle: "bold", textColor: [86, 99, 93] },
      1: { cellWidth: contentW / 2, fontStyle: "bold", halign: "center" },
    },
  });

  return lastTableY(doc) + 8;
}

function appendCuttingResult(
  doc: jsPDF,
  fontName: string,
  plan: RankedPlan,
  coil: CoilInput,
  margin: number,
  contentW: number,
  startY: number,
): void {
  let y = startY;
  const pageH = doc.internal.pageSize.getHeight();
  const ensure = (need: number) => {
    if (y + need > pageH - 14) {
      doc.addPage();
      y = 16;
    }
  };

  ensure(20);
  doc.setFont(fontName, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND);
  doc.text("Resultado do corte", margin, y);
  y += 6;

  doc.setFont(fontName, "normal");
  doc.setFontSize(8);
  doc.setTextColor(27, 36, 44);
  doc.text(
    `${plan.setupCount} programa${plan.setupCount > 1 ? "s" : ""} de corte`,
    margin,
    y,
  );
  y += 6;

  plan.programs.forEach((program, idx) => {
    const programCoil = coilForProgram(program, plan.products, coil);
    ensure(70);
    doc.setFont(fontName, "bold");
    doc.setFontSize(10);
    doc.setTextColor(27, 36, 44);
    const seen = new Set<number>();
    const specs: string[] = [];
    for (const strip of program.pattern.strips) {
      if (seen.has(strip.productIndex)) continue;
      seen.add(strip.productIndex);
      const blank = plan.products[strip.productIndex]?.blank;
      if (blank) specs.push(blankSpecCitationLine(blank));
    }
    const titleExtra = specs.length
      ? specs.join(" + ")
      : program.pattern.strips.map((s) => `${fmtInt(s.stripWidth)} mm`).join(" + ");
    doc.text(`Programa ${idx + 1}  ·  ${titleExtra}`, margin, y);
    y += 5;
    doc.setFont(fontName, "normal");
    doc.setFontSize(8);
    doc.setTextColor(91, 103, 115);
    doc.text(`Comprimento total: ${fmtMeters(program.coilLengthMm)}`, margin, y);
    y += 3;
    drawStripBar(
      doc,
      plan,
      programCoil.width,
      programCoil.edgeTrim,
      idx,
      margin,
      y,
      contentW,
      8,
      fontName,
    );
    y += 20;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [
        ["Tipo", "Acabamento", "PVC", "Espessura", "Largura", "Comprimento", "Peças nesta tira", "Cortes"],
      ],
      body: groupIdenticalStrips(program.pattern.strips).map((strip) => {
        const blank = plan.products[strip.productIndex]?.blank;
        const continuous = blank && isSlitterItem(blank) && strip.cutLength <= 1 + 1e-9;
        const n = continuous ? 1 : Math.floor((program.coilLengthMm + 1e-6) / strip.cutLength);
        const displayLen = continuous ? program.coilLengthMm : strip.cutLength;
        const spec = blank ? blankSpecCitation(blank) : null;
        return [
          spec?.tipo ?? "—",
          spec?.acabamento ?? "—",
          spec?.pvc ?? "—",
          spec?.espessura ?? "—",
          fmtPlainMm(strip.stripWidth),
          `${fmtPlainMm(displayLen)}${strip.rotated ? " (girado)" : ""}`,
          fmtInt(n),
          fmtInt(strip.stripCount),
        ];
      }),
      headStyles: { font: fontName, fontStyle: "bold", fillColor: BRAND, textColor: 255, fontSize: 6.5 },
      bodyStyles: { font: fontName },
      styles: { font: fontName, fontSize: 7, cellPadding: 1.2 },
      columnStyles: { 6: { halign: "right" }, 7: { halign: "right" } },
    });
    y = lastTableY(doc) + 6;

    const usefulKg = program.weightPerProductKg.reduce((s, w) => s + w, 0);
    const progBreakdown = lossBreakdown([program], usefulKg, programCoil);

    doc.setFont(fontName, "bold");
    doc.setFontSize(10);
    doc.setTextColor(27, 36, 44);
    doc.text("Melhor aproveitamento", margin, y);
    y += 4;
    doc.setFont(fontName, "normal");
    doc.setFontSize(7);
    doc.setTextColor(91, 103, 115);
    const lossLines = doc.splitTextToSize(
      formatLossInfoNote({
        longitudinalPct: progBreakdown.longitudinalPct,
        widthWasteMm: progBreakdown.widthWasteMm,
        transversalPct: progBreakdown.transversalPct,
        transversalKg: progBreakdown.transversalKg,
        edgeTrimTotalMm: programCoil.edgeTrim * 2,
        refilePct: progBreakdown.refilePct,
        refileKg: progBreakdown.refileKg,
      }),
      contentW,
    );
    doc.text(lossLines, margin, y);
    y += lossLines.length * 3.2 + 3;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Aproveitamento", "Peso necessário"]],
      body: [
        [
          fmtPct(progBreakdown.yieldPercent),
          fmtKg(progBreakdown.physicalCoilKg),
        ],
      ],
      headStyles: {
        font: fontName,
        fontStyle: "bold",
        fillColor: BRAND,
        textColor: 255,
        fontSize: 7.5,
        halign: "center",
      },
      bodyStyles: { font: fontName, fontStyle: "bold", fontSize: 9, halign: "center" },
      styles: { font: fontName, cellPadding: 2 },
    });
    y = lastTableY(doc) + 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Item", "Pedido", "Peso un.", "Produzido", "Peso produzido"]],
      body: productIndicesInProgram(program).flatMap((index) => {
        const product = plan.products[index];
        if (!product) return [];
        const pieces = program.piecesPerProduct[index] ?? 0;
        const weightKg = program.weightPerProductKg[index] ?? 0;
        return [[
          isSlitterItem(product.blank)
            ? `${fmtPlainInt(product.blank.width)} mm slitter`
            : `${fmtPlainInt(product.blank.width)} × ${fmtPlainInt(product.blank.length)} mm`,
          isSlitterItem(product.blank)
            ? `${product.blank.minQty > 0 ? `${fmtInt(product.blank.minQty)} un · ` : ""}${fmtKg(product.blank.minKg)}`
            : `${fmtInt(product.blank.minQty)} un · ${fmtKg(product.blank.minKg)}`,
          isSlitterItem(product.blank)
            ? `${fmtNumber(product.unitWeightKg, 4)} Kg/mm`
            : fmtKg(product.unitWeightKg),
          isSlitterItem(product.blank) ? fmtMeters(pieces) : `${fmtInt(pieces)} un`,
          fmtKg(weightKg),
        ]];
      }),
      headStyles: { font: fontName, fontStyle: "bold", fillColor: BRAND, textColor: 255, fontSize: 7.5 },
      bodyStyles: { font: fontName },
      styles: { font: fontName, fontSize: 8, cellPadding: 1.8 },
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
    });
    y = lastTableY(doc) + 8;
  });
}

/** PDF no padrão chapas-bobinas: cliente = itens+totais+condições; liganer = tudo + resultado do corte. */
export function buildQuotePdf(input: QuotePdfInput): jsPDF {
  const { variant, items, conditions, summary, lossByItemId = {}, plan = null, coil } = input;
  const landscape = true;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const fontName = registerPdfFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  let y = appendBanner(doc, fontName, variant, items.length, pageW, margin);
  const freteFraction = parseFretePercent(conditions.frete);
  y = appendItemsTable(doc, fontName, variant, items, lossByItemId, coil, margin, y, freteFraction);
  y = appendTotalsAndConditions(doc, fontName, summary, conditions, margin, contentW, y, variant);

  if ((variant === "liganer" || variant === "gestao") && plan && coil) {
    appendCuttingResult(doc, fontName, plan, coil, margin, contentW, y);
  }

  const pageCount = doc.getNumberOfPages();
  const footer =
    variant === "cliente"
      ? "Liganer · Proposta comercial"
      : variant === "gestao"
        ? "Liganer · Gestão"
        : "Liganer · Uso interno Liganer";
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(fontName, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 148, 156);
    doc.text(footer, margin, pageH - 6);
    doc.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 6, { align: "right" });
  }

  return doc;
}

export function downloadQuotePdf(input: QuotePdfInput): void {
  buildQuotePdf(input).save(reportFileName(input.variant, input.plan));
}

/** @deprecated Use buildQuotePdf({ variant: "liganer", ... }) */
export function buildPlanPdf(plan: RankedPlan, coil: CoilInput): jsPDF {
  return buildQuotePdf({
    variant: "liganer",
    items: plan.products.map((p) => p.blank),
    conditions: {
      pagamento: "",
      prazo_entrega: "",
      local_expedicao: "",
      cidade_cliente: "",
      tipo_frete: "",
      observacoes_gerais: "",
      frete: "",
    },
    summary: { totalKg: 0, subtotal: 0, ipi: 0, total: 0, frete: 0 },
    plan,
    coil,
  });
}

/** @deprecated Use downloadQuotePdf */
export function downloadPlanPdf(plan: RankedPlan, coil: CoilInput): void {
  buildPlanPdf(plan, coil).save(reportFileName("liganer", plan));
}
