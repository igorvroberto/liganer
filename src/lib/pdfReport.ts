import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtDim, fmtInt, fmtKg, fmtMeters, fmtMm, fmtNumber, fmtPct, fmtThickness } from "./format";
import { BLANK_COLORS, DEFAULT_DENSITY, type CoilInput, type RankedPlan } from "./types";

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

function drawStripBar(
  doc: jsPDF,
  plan: RankedPlan,
  coilWidth: number,
  programIndex: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const program = plan.programs[programIndex];
  let cursor = x;
  for (const strip of program.pattern.strips) {
    const w = (strip.stripWidth / coilWidth) * width;
    const rgb = hexToRgb(BLANK_COLORS[strip.productIndex % BLANK_COLORS.length]);
    doc.setFillColor(...rgb);
    doc.rect(cursor, y, w, height, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    if (w > 18) {
      doc.text(fmtInt(strip.stripWidth), cursor + w / 2, y + height / 2 + 1.2, { align: "center" });
    }
    cursor += w;
  }
  if (program.pattern.waste > 0.5) {
    const w = (program.pattern.waste / coilWidth) * width;
    doc.setFillColor(236, 239, 242);
    doc.rect(cursor, y, w, height, "F");
    doc.setTextColor(91, 103, 115);
    doc.setFontSize(8);
    if (w > 22) {
      doc.text(`sucata ${fmtInt(program.pattern.waste)}`, cursor + w / 2, y + height / 2 + 1.2, {
        align: "center",
      });
    }
  }
  doc.setDrawColor(213, 221, 228);
  doc.rect(x, y, width, height, "S");
  doc.setTextColor(27, 36, 44);
}

export function buildPlanPdf(plan: RankedPlan, coil: CoilInput): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 18;

  doc.setFillColor(22, 56, 74);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Liganer", margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Relatório de corte de blanks", margin, 19);
  const generated = new Date().toLocaleString("pt-BR");
  doc.setFontSize(8);
  doc.text(generated, pageW - margin, 12, { align: "right" });
  doc.text(`${plan.setupCount} programa${plan.setupCount > 1 ? "s" : ""}`, pageW - margin, 19, {
    align: "right",
  });

  y = 38;
  doc.setTextColor(27, 36, 44);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Bobina", margin, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.6 },
    body: [
      ["Largura", fmtMm(coil.width), "Espessura", `${fmtThickness(coil.thickness)} mm`],
      ["Densidade", `${fmtNumber(DEFAULT_DENSITY, 0)} g/cm³`, "Comprimento", fmtMeters(plan.totalCoilLengthMm)],
      ["Perda de faca", fmtMm(coil.kerf), "Refile (cada lado)", fmtMm(coil.edgeTrim)],
    ],
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(27, 36, 44);
  doc.text("Resumo do plano", margin, y);
  y += 4;

  const kpis = [
    ["Aproveitamento", fmtPct(plan.yieldPercent)],
    ["Peso da bobina", fmtKg(plan.coilWeightKg)],
    ["Peso útil", fmtKg(plan.usefulWeightKg)],
    ["Sucata", fmtKg(plan.scrapKg)],
  ];
  const boxW = contentW / 4 - 2;
  kpis.forEach((kpi, i) => {
    const x = margin + i * (boxW + 2.6);
    doc.setFillColor(i === 0 ? 231 : 246, i === 0 ? 244 : 248, i === 0 ? 236 : 250);
    doc.roundedRect(x, y, boxW, 16, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(91, 103, 115);
    doc.text(kpi[0], x + 3, y + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(i === 0 ? 45 : 27, i === 0 ? 106 : 36, i === 0 ? 79 : 44);
    doc.text(kpi[1], x + 3, y + 12);
  });

  y += 24;
  plan.programs.forEach((program, idx) => {
    const needed = 52;
    if (y + needed > 280) {
      doc.addPage();
      y = 18;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(27, 36, 44);
    const strips = program.pattern.strips
      .map((s) => `${fmtInt(s.stripWidth)} mm`)
      .join(" + ");
    doc.text(`Programa ${idx + 1}  ·  ${fmtMeters(program.coilLengthMm)}  ·  ${strips}`, margin, y);
    y += 4;
    drawStripBar(doc, plan, coil.width, idx, margin, y, contentW, 10);
    y += 14;

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
      headStyles: { fillColor: [22, 56, 74], textColor: 255, fontSize: 8 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 2: { halign: "right" } },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  });

  if (y + 40 > 280) {
    doc.addPage();
    y = 18;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(27, 36, 44);
  doc.text("Produção por blank", margin, y);
  y += 3;

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
    headStyles: { fillColor: [22, 56, 74], textColor: 255, fontSize: 8 },
    styles: { fontSize: 9, cellPadding: 2.2 },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(91, 103, 115);
  doc.text(
    "O corte pode ultrapassar um pouco o pedido quando os blanks compartilham o mesmo programa na bobina. Densidade 8 g/cm³.",
    margin,
    y,
    { maxWidth: contentW },
  );

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
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
