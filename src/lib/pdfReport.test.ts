import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { fmtInt } from "./format";
import { optimizeCutting } from "./optimize";
import { PDF_FONT_NAME, registerPdfFonts } from "./pdfFonts";
import { buildPlanPdf, reportFileName } from "./pdfReport";
import { DEFAULT_DENSITY } from "./types";

function pdfLatin1(doc: ReturnType<typeof buildPlanPdf>): string {
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

describe("pdfReport", () => {
  it("gera um PDF do plano selecionado", () => {
    const coil = { width: 1250, thickness: 0.4, density: DEFAULT_DENSITY, kerf: 0, edgeTrim: 0, line: "430 2B" };
    const result = optimizeCutting({
      coil,
      blanks: [
        { id: "a", name: "", width: 600, length: 470, minKg: 1000, minQty: 0 },
        { id: "b", name: "", width: 650, length: 530, minKg: 1000, minQty: 0 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const doc = buildPlanPdf(result.alternatives[0], coil);
    const bytes = doc.output("arraybuffer");
    expect(bytes.byteLength).toBeGreaterThan(1500);
    expect(reportFileName(result.alternatives[0])).toMatch(/^liganer-corte-blanks-\d+prog-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("embute fonte latina e preserva acento, cedilha e til", () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    registerPdfFonts(doc);
    for (const glyph of ["\u00e1", "\u00e9", "\u00ed", "\u00f3", "\u00fa", "\u00e3", "\u00f5", "\u00e2", "\u00ea", "\u00f4", "\u00e7"]) {
      expect(doc.getTextWidth(glyph), glyph).toBeGreaterThan(0.4);
    }

    const coil = {
      width: 1250,
      thickness: 0.4,
      density: DEFAULT_DENSITY,
      kerf: 0,
      edgeTrim: 0,
      allowOvershoot: false,
      line: "430 2B",
    };
    const result = optimizeCutting({
      coil,
      blanks: [
        { id: "a", name: "", width: 600, length: 470, minKg: 1000, minQty: 0 },
        { id: "b", name: "", width: 650, length: 530, minKg: 1000, minQty: 0 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pdf = buildPlanPdf(result.alternatives[0], coil);
    expect(pdf.getFont().fontName).toBe(PDF_FONT_NAME);

    const raw = pdfLatin1(pdf);
    expect(raw.toLowerCase()).toContain("robotolatin");

    const text = decodePdfText(raw);
    expect(text).toContain("Relat\u00f3rio de corte de blanks");
    expect(text).toContain("N\u00e3o");
    expect(text).toContain("Peso \u00fatil");
    expect(text).toContain("Tipo");
    expect(text).toContain("Acabamento");
    expect(text).toContain("PVC");
    expect(text).toContain("Espessura");
    expect(text).toContain("Largura");
    expect(text).toContain("Comprimento");
    expect(text).toContain("Pe\u00e7as");
    expect(text).toContain("Sobra");
    expect(text).toContain("Produ\u00e7\u00e3o por item");
    expect(text).toContain("P\u00e1gina");
    expect(text).toContain("s\u00e3o");
    expect(text).toContain("necess\u00e1rio");
  });

  it("mostra a sucata em mm na barra do programa", () => {
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
    const plan = result.alternatives.find((alt) => alt.programs.some((p) => p.pattern.waste > 0.5)) ?? result.alternatives[0];
    const wasteProgram = plan.programs.find((p) => p.pattern.waste > 0.5);
    expect(wasteProgram).toBeTruthy();
    if (!wasteProgram) return;

    const text = decodePdfText(pdfLatin1(buildPlanPdf(plan, coil)));
    expect(text).toContain(`sobra ${fmtInt(wasteProgram.pattern.waste)}`);
  });
});
