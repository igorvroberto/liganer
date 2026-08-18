import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtDim, fmtInt, fmtKg, fmtMeters, fmtMm, fmtPct, fmtThickness } from "./format";
import { BLANK_COLORS, type CoilInput, type RankedPlan } from "./types";
import { programLoss } from "./optimize";
import { registerPdfFonts } from "./pdfFonts";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

function reportFileName(plan: RankedPlan): string {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  return `liganer-corte-blanks-${plan.setupCount}prog-${stamp}.pdf`;
}

function lastTableY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function drawStripBar(
  doc: jsPDF,
  plan: RankedPlan,
  coilWidth: number,
  programIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
  fontName: string,
) {
  const program = plan.programs[programIndex];
  const scale = 0.82;
  const barW = width * scale;
  const barX = x + (width - barW) / 2;

  const paint = (
    colorOf: (index: number) => string,
    labelOf: (strip: (typeof program.pattern.strips)[number]) => string,
    rowY: number,
  ) => {
    let cursor = barX;
    for (const strip of program.pattern.strips) {
      const w = (strip.stripWidth / coilWidth) * barW;
      const rgb = hexToRgb(colorOf(strip.productIndex));
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
      const w = Math.max((program.pattern.waste / coilWidth) * barW, 8);
      doc.setFillColor(210, 214, 218);
      doc.rect(cursor, rowY, w, height, "F");
      doc.setTextColor(70, 80, 88);
      doc.setFontSize(6.5);
      doc.setFont(fontName, "bold");
      doc.text("sucata", cursor + w / 2, rowY + height / 2 + 1, { align: "center" });
    }
    doc.setDrawColor(213, 221, 228);
    doc.rect(barX, rowY, barW, height, "S");
  };

  const colorOf = (index: number) => BLANK_COLORS[index % BLANK_COLORS.length];
  paint(colorOf, (strip) => fmtInt(strip.stripWidth), y);
  paint(colorOf, (strip) => fmtInt(strip.cutLength), y + height + 2);
  doc.setTextColor(27, 36, 44);
}

export function buildPlanPdf(plan: RankedPlan, coil: CoilInput): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const fontName = registerPdfFonts(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 16;

  doc.setFillColor(22, 56, 74);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontName, "bold");
  doc.setFontSize(13);
  doc.text("Liganer", margin, 10);
  doc.setFont(fontName, "normal");
  doc.setFontSize(9);
  doc.text("Relatório de corte de blanks", margin, 17);
  const generated = new Date().toLocaleString("pt-BR");
  doc.setFontSize(8);
  doc.text(generated, pageW - margin, 10, { align: "right" });
  doc.text(`${plan.setupCount} programa${plan.setupCount > 1 ? "s" : ""}`, pageW - margin, 17, {
    align: "right",
  });

  y = 32;
  doc.setTextColor(27, 36, 44);
  doc.setFont(fontName, "bold");
  doc.setFontSize(10);
  doc.text("Bobina", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { font: fontName, fontSize: 8.5, cellPadding: 1.2 },
    bodyStyles: { font: fontName },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42 },
      1: { cellWidth: contentW - 42 },
    },
    body: [
      ["Linha", coil.line?.trim() ? coil.line.trim() : "-"],
      ["Espessura", `${fmtThickness(coil.thickness)} mm`],
      ["Largura", fmtMm(coil.width)],
      ["Refile (cada lado)", fmtMm(coil.edgeTrim)],
      ["Perda entre tiras / faca", fmtMm(coil.kerf)],
      ["Comprimento", fmtMeters(plan.totalCoilLengthMm)],
      ["Peso pode ultrapassar", coil.allowOvershoot === false ? "Não" : "Sim"],
    ],
  });

  y = lastTableY(doc) + 6;
  doc.setFont(fontName, "bold");
  doc.setFontSize(10);
  doc.setTextColor(27, 36, 44);
  doc.text("Resumo do plano", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Aproveitamento", "Peso da bobina", "Peso útil", "Sucata"]],
    body: [[fmtPct(plan.yieldPercent), fmtKg(plan.coilWeightKg), fmtKg(plan.usefulWeightKg), fmtKg(plan.scrapKg)]],
    headStyles: { font: fontName, fontStyle: "bold", fillColor: [22, 56, 74], textColor: 255, fontSize: 7.5, halign: "center" },
    bodyStyles: { font: fontName, fontStyle: "bold", fontSize: 9, halign: "center" },
    styles: { font: fontName, cellPadding: 2 },
  });

  y = lastTableY(doc) + 8;
  plan.programs.forEach((program, idx) => {
    const needed = 58;
    if (y + needed > 275) {
      doc.addPage();
      y = 16;
    }
    doc.setFont(fontName, "bold");
    doc.setFontSize(10);
    doc.setTextColor(27, 36, 44);
    const strips = program.pattern.strips.map((s) => `${fmtInt(s.stripWidth)} mm`).join(" + ");
    doc.text(`Programa ${idx + 1}  ·  ${fmtMeters(program.coilLengthMm)}  ·  ${strips}`, margin, y);
    y += 3;
    drawStripBar(doc, plan, coil.width, idx, margin, y, contentW, 8, fontName);
    y += 20;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Tira", "Orientação", "Peças nesta tira"]],
      body: program.pattern.strips.map((strip) => {
        const n = Math.floor((program.coilLengthMm + 1e-6) / strip.cutLength);
        return [
          fmtMm(strip.stripWidth),
          `${fmtDim(strip.stripWidth, strip.cutLength)}${strip.rotated ? " (girado)" : ""}`,
          fmtInt(n),
        ];
      }),
      headStyles: { font: fontName, fontStyle: "bold", fillColor: [22, 56, 74], textColor: 255, fontSize: 7.5 },
      bodyStyles: { font: fontName },
      styles: { font: fontName, fontSize: 8, cellPadding: 1.6 },
      columnStyles: { 2: { halign: "right" } },
    });
    y = lastTableY(doc) + 4;
    const loss = programLoss(program, coil);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "plain",
      styles: { font: fontName, fontSize: 8, cellPadding: 1, textColor: [91, 103, 115] },
      bodyStyles: { font: fontName },
      body: [
        [
          `Perda: ${fmtPct(loss.lossPercent)}`,
          `Sucata: ${fmtKg(loss.scrapKg)}`,
          `Largura não usada: ${fmtMm(loss.widthWasteMm)} (${fmtPct(loss.widthLossPercent)})`,
        ],
      ],
    });
    y = lastTableY(doc) + 7;
  });

  if (y + 36 > 275) {
    doc.addPage();
    y = 16;
  }
  doc.setFont(fontName, "bold");
  doc.setFontSize(10);
  doc.setTextColor(27, 36, 44);
  doc.text("Produção por blank", margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Blank", "Pedido", "Peso un.", "Produzido", "Peso produzido"]],
    body: plan.products.map((product) => [
      fmtDim(product.blank.width, product.blank.length),
      `${fmtInt(product.blank.minQty)} un · ${fmtKg(product.blank.minKg)}`,
      fmtKg(product.unitWeightKg),
      `${fmtInt(product.pieces)} un`,
      fmtKg(product.weightKg),
    ]),
    headStyles: { font: fontName, fontStyle: "bold", fillColor: [22, 56, 74], textColor: 255, fontSize: 7.5 },
    bodyStyles: { font: fontName },
    styles: { font: fontName, fontSize: 8, cellPadding: 1.8 },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
  });

  y = lastTableY(doc) + 6;
  doc.setFont(fontName, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(91, 103, 115);
  doc.text(
    coil.allowOvershoot === false
      ? "O peso de cada item não ultrapassa o valor digitado. Tiras do mesmo programa são reduzidas quando necessário."
      : "O corte pode ultrapassar um pouco o pedido quando os blanks compartilham o mesmo programa na bobina.",
    margin,
    y,
    { maxWidth: contentW },
  );

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont(fontName, "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 148, 156);
    doc.text(`Página ${i} de ${pageCount}`, pageW / 2, 291, { align: "center" });
  }

  return doc;
}

export function downloadPlanPdf(plan: RankedPlan, coil: CoilInput): void {
  buildPlanPdf(plan, coil).save(reportFileName(plan));
}

export { reportFileName };
