import { describe, expect, it } from "vitest";
import { optimizeCutting } from "./optimize";
import { buildQuotePdfHtml } from "./quotePdfExport";
import { EMPTY_QUOTE_CONDITIONS } from "./quoteSummary";
import { DEFAULT_DENSITY } from "./types";

const blanks = [
  {
    id: "a",
    name: "",
    width: 600,
    length: 470,
    minKg: 1000,
    minQty: 0,
    tipo: "201",
    acabamento: "2B",
    pvc: "sem" as const,
    thickness: 0.6,
  },
  {
    id: "b",
    name: "",
    width: 650,
    length: 530,
    minKg: 1000,
    minQty: 0,
    tipo: "201",
    acabamento: "2B",
    pvc: "azul" as const,
    thickness: 0.6,
  },
];

describe("quotePdfExport (layout chapas)", () => {
  it("PDF cliente usa o HTML/print do chapas e não inclui resultado do corte", () => {
    const html = buildQuotePdfHtml({
      kind: "cliente",
      items: blanks,
      conditions: { ...EMPTY_QUOTE_CONDITIONS, pagamento: "30 dias" },
      summary: { totalKg: 2000, subtotal: 1000, ipi: 32.5, total: 1032.5, frete: 0 },
      client: { name: "Cliente Teste", cnpj: "00.000.000/0001-00" },
    });
    expect(html).toContain('class="pdf-cliente"');
    expect(html).toContain("Salvar em PDF");
    expect(html).toContain("Totais");
    expect(html).toContain("Condições");
    expect(html).toContain("30 dias");
    expect(html).toContain("Cliente Teste");
    expect(html).toContain("@page { size: A4 landscape");
    expect(html).toContain("#c60000");
    expect(html).not.toContain("Resultado do corte");
    expect(html).not.toContain("Fator\nutilizado");
    expect(html).not.toContain(">ICMS<");
  });

  it("PDF Liganer inclui Resultado do corte e campos internos", () => {
    const coil = {
      width: 1250,
      thickness: 0.4,
      density: DEFAULT_DENSITY,
      kerf: 0,
      edgeTrim: 5,
      allowOvershoot: true,
    };
    const result = optimizeCutting({ coil, blanks });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = buildQuotePdfHtml({
      kind: "liganer",
      items: blanks,
      conditions: EMPTY_QUOTE_CONDITIONS,
      summary: { totalKg: 0, subtotal: 0, ipi: 0, total: 0, frete: 0 },
      plan: result.alternatives[0],
      coil,
    });
    expect(html).toContain('class="pdf-liganer"');
    expect(html).toContain("Resultado do corte");
    expect(html).toContain("Produção por item");
    expect(html).toContain("Fator");
    expect(html).toContain("ICMS");
    expect(html).toContain("Sem condições preenchidas");
  });
});
