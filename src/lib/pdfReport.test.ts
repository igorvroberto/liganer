import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { fmtInt } from "./format";
import { optimizeCutting } from "./optimize";
import { PDF_FONT_NAME, registerPdfFonts } from "./pdfFonts";
import { buildPlanPdf, buildQuotePdf, reportFileName } from "./pdfReport";
import { EMPTY_QUOTE_CONDITIONS } from "./quoteSummary";
import { DEFAULT_DENSITY } from "./types";

function pdfLatin1(doc: jsPDF): string {
  return new TextDecoder("latin1").decode(doc.output("arraybuffer"));
}

function decodePdfText(raw: string): string {
  const cmap = new Map<number, number>();
  for (const block of raw.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)><([0-9a-fA-F]+)>/g)) {
      cmap.set(Number.parseInt(pair[1], 16), Number.parseInt(pair[2], 16));
    }
  }
  const parts: string[] = [];
  for (const match of raw.matchAll(/<([0-9A-Fa-f]+)> Tj/g)) {
    const hex = match[1];
    if (hex.length % 4 !== 0) continue;
    let text = "";
    for (let i = 0; i < hex.length; i += 4) {
      const cid = Number.parseInt(hex.slice(i, i + 4), 16);
      text += String.fromCharCode(cmap.get(cid) ?? cid);
    }
    parts.push(text);
  }
  return parts.join("\n");
}

const blanks = [
  { id: "a", name: "", width: 600, length: 470, minKg: 1000, minQty: 0 },
  { id: "b", name: "", width: 650, length: 530, minKg: 1000, minQty: 0 },
];

describe("pdfReport", () => {
  it("PDF cliente tem itens/totais/condições e não inclui resultado do corte", () => {
    const coil = { width: 1250, thickness: 0.4, density: DEFAULT_DENSITY, kerf: 0, edgeTrim: 0, line: "430 2B" };
    const result = optimizeCutting({ coil, blanks });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const doc = buildQuotePdf({
      variant: "cliente",
      items: blanks,
      conditions: { ...EMPTY_QUOTE_CONDITIONS, pagamento: "30 dias" },
      summary: { totalKg: 1000, subtotal: 100, ipi: 3.25, total: 103.25, frete: 0 },
      plan: result.alternatives[0],
      coil,
    });
    const text = decodePdfText(pdfLatin1(doc));
    expect(text).toContain("Proposta comercial");
    expect(text).toContain("Totais");
    expect(text).toContain("Condi\u00e7\u00f5es");
    expect(text).toContain("30 dias");
    expect(text).not.toContain("Resultado do corte");
    expect(text).not.toContain("Produ\u00e7\u00e3o por item");
    expect(reportFileName("cliente")).toMatch(/^\d{8}\.pdf$/);
  });

  it("PDF Liganer inclui Resultado do corte", () => {
    const coil = {
      width: 1250,
      thickness: 0.4,
      density: DEFAULT_DENSITY,
      kerf: 0,
      edgeTrim: 0,
      allowOvershoot: false,
      line: "430 2B",
    };
    const result = optimizeCutting({ coil, blanks });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plan = result.alternatives[0];
    const pdf = buildQuotePdf({
      variant: "liganer",
      items: blanks,
      conditions: EMPTY_QUOTE_CONDITIONS,
      summary: { totalKg: 0, subtotal: 0, ipi: 0, total: 0, frete: 0 },
      plan,
      coil,
    });
    expect(pdf.getFont().fontName).toBe(PDF_FONT_NAME);

    const raw = pdfLatin1(pdf);
    expect(raw.toLowerCase()).toContain("robotolatin");

    const text = decodePdfText(raw);
    expect(text).toContain("Uso interno Liganer");
    expect(text).toContain("Resultado do corte");
    expect(text).toContain("Totais");
    expect(text).toContain("Condi\u00e7\u00f5es");
    expect(text).toContain("Melhor aproveitamento");
    expect(text).toContain("Peso necess\u00e1rio");
    expect(text).toContain("Peso \u00fatil");
    expect(text).toContain("Tipo");
    expect(text).toContain("Acabamento");
    expect(text).toContain("PVC");
    expect(text).toContain("Peso produzido");
    expect(text).toContain("P\u00e1gina");
    expect(reportFileName("liganer", plan)).toMatch(/^\d{8}\.pdf$/);
  });

  it("mostra a sucata em mm na barra do programa (Liganer)", () => {
    const coil = { width: 1250, thickness: 0.4, density: DEFAULT_DENSITY, kerf: 0, edgeTrim: 5 };
    const result = optimizeCutting({
      coil,
      blanks: [
        { id: "a", name: "", width: 600, length: 470, minKg: 1000, minQty: 0 },
        { id: "b", name: "", width: 700, length: 500, minKg: 1000, minQty: 0 },
        { id: "c", name: "", width: 750, length: 550, minKg: 1000, minQty: 0 },
        { id: "d", name: "", width: 650, length: 530, minKg: 1000, minQty: 0 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const plan =
      result.alternatives.find((alt) => alt.programs.some((p) => p.pattern.waste > 0.5)) ??
      result.alternatives[0];
    const wasteProgram = plan.programs.find((p) => p.pattern.waste > 0.5);
    expect(wasteProgram).toBeTruthy();
    if (!wasteProgram) return;

    const text = decodePdfText(pdfLatin1(buildPlanPdf(plan, coil)));
    expect(text).toContain(`sobra ${fmtInt(wasteProgram.pattern.waste)}`);
  });
});
