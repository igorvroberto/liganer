import { describe, expect, it } from "vitest";
import { optimizeCutting } from "./optimize";
import { buildPlanPdf, reportFileName } from "./pdfReport";
import { DEFAULT_DENSITY } from "./types";

describe("pdfReport", () => {
  it("gera um PDF do plano selecionado", () => {
    const coil = { width: 1250, thickness: 0.4, density: DEFAULT_DENSITY, kerf: 0, edgeTrim: 0 };
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
});
