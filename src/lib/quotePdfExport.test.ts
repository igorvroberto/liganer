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
      number: "26091401",
    });
    expect(html).toContain('class="pdf-cliente"');
    expect(html).toContain("Salvar em PDF");
    expect(html).toContain("Totais");
    expect(html).toContain("Condições");
    expect(html).toContain("30 dias");
    expect(html).toContain("Cliente Teste");
    expect(html).toContain("<title>26091401</title>");
    expect(html).toContain("Nº 26091401");
    expect(html).not.toContain("Orçamento Nº");
    expect(html).toContain("#c60000");
    expect(html).not.toContain("Resultado do corte");
    expect(html).not.toContain("Fator\nutilizado");
    expect(html).not.toContain("Material");
    expect(html).not.toContain("Peso\ntotal");
    expect(html).not.toContain("Sobra\nmm");
    // Colunas do PDF cliente na ordem pedida (Item + campos).
    const headMatch = html.match(/<table class="items">[\s\S]*?<thead>[\s\S]*?<tr>([\s\S]*?)<\/tr>[\s\S]*?<\/thead>/);
    expect(headMatch).toBeTruthy();
    const headers = [...(headMatch?.[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g) ?? [])].map((m) =>
      m[1].replace(/<br\s*\/?>/gi, "\n").replace(/&nbsp;/g, " ").trim(),
    );
    expect(headers).toEqual([
      "Item",
      "Tipo",
      "Acabamento",
      "PVC",
      "Espessura",
      "Largura",
      "Comprimento",
      "Quantidade",
      "Peso\nunitário",
      "ICMS",
      "Preço\nsem\nIPI",
      "Subtotal",
      "Observação",
    ]);
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
    expect(html).toContain("pattern-bar");
    expect(html).toContain("cut-legacy");
    expect(html).toContain("Melhor aproveitamento");
    expect(html).toContain("Sobra longitudinal");
    expect(html).not.toContain("Sobra total");
    expect(html).not.toContain("desconsiderando o refile");
    expect(html).toContain("Peso necessário");
    expect(html).toContain("Peso produzido");
    expect(html).not.toMatch(/Sobra\s+[\d.,]+\s*mm/);
    expect(html).toContain("Fator");
    expect(html).toContain("ICMS");
    expect(html).not.toContain("Sem condições preenchidas");
    expect(html).not.toContain("<h2>Condições</h2>");
    expect(html).toContain("print-color-adjust: exact");
  });

      it("PDF não usa separador de milhar em largura original, largura e comprimento", () => {
    const items = [
      {
        ...blanks[0],
        coilWidth: 1250,
        width: 1000,
        length: 2000,
      },
    ];
    const coil = {
      width: 1250,
      thickness: 0.4,
      density: DEFAULT_DENSITY,
      kerf: 0,
      edgeTrim: 5,
      allowOvershoot: true,
    };
    const result = optimizeCutting({ coil, blanks: items });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const cellText = (html: string) =>
      [...html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
        m[1].replace(/<[^>]+>/g, "").trim(),
      );

    for (const kind of ["cliente", "liganer", "gestao"] as const) {
      const html = buildQuotePdfHtml({
        kind,
        items,
        conditions: EMPTY_QUOTE_CONDITIONS,
        summary: { totalKg: 1000, subtotal: 100, ipi: 3.25, total: 103.25, frete: 0 },
        plan: kind === "cliente" ? null : result.alternatives[0],
        coil: kind === "cliente" ? undefined : coil,
      });
      const itemsTable = html.match(/<table class="items">[\s\S]*?<\/table>/)?.[0] ?? "";
      const cells = cellText(itemsTable);
      // Largura / comprimento sem milhar
      expect(cells).toContain("1000");
      expect(cells).toContain("2000");
      const widthIdx = cells.indexOf("1000");
      const lengthIdx = cells.indexOf("2000");
      expect(widthIdx).toBeGreaterThanOrEqual(0);
      expect(lengthIdx).toBeGreaterThanOrEqual(0);
      expect(cells[widthIdx]).toBe("1000");
      expect(cells[lengthIdx]).toBe("2000");
      if (kind !== "cliente") {
        expect(cells).toContain("1250");
        expect(cells).not.toContain("1.250");
        expect(html).toContain("1000 × 2000 mm");
        expect(html).not.toContain("1.000 × 2.000 mm");
      }
    }
  });

  it("PDF gestão inclui resultado do corte sem colunas internas sensíveis", () => {
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
      kind: "gestao",
      items: blanks,
      conditions: EMPTY_QUOTE_CONDITIONS,
      summary: { totalKg: 0, subtotal: 0, ipi: 0, total: 0, frete: 0 },
      plan: result.alternatives[0],
      coil,
    });
    expect(html).toContain('class="pdf-liganer"');
    expect(html).toContain("Resultado do corte");
    expect(html).toContain("Melhor aproveitamento");
    expect(html).toContain("Sobra longitudinal");
    expect(html).not.toContain("Sobra total");
    expect(html).not.toContain("desconsiderando o refile");
    expect(html).toContain("Peso necessário");
    expect(html).toContain("Fator\nutilizado");
    expect(html).not.toContain("Observação");
    expect(html).not.toContain("Preço\nfator\n100");
    expect(html).not.toContain("Fator\nmáximo");
    expect(html).not.toContain(">Comissão<");
    expect(html).not.toContain("FIL\nIND\nMTO");
    expect(html).not.toContain("AÇOS\nPRIME\nMTO");
    expect(html).not.toContain("IMG\nMTO");
    expect(html).not.toContain("CSA\nMTO");
    expect(html).not.toContain("TETTO\nMTO");
  });


  it("omite a seção Condições no PDF quando nenhuma condição está preenchida", () => {
    const html = buildQuotePdfHtml({
      kind: "cliente",
      items: blanks,
      conditions: EMPTY_QUOTE_CONDITIONS,
      summary: { totalKg: 2000, subtotal: 1000, ipi: 32.5, total: 1032.5, frete: 0 },
      client: { name: "Cliente Teste", cnpj: "00.000.000/0001-00" },
    });
    expect(html).toContain("Totais");
    expect(html).not.toContain("<h2>Condições</h2>");
    expect(html).not.toContain("Sem condições preenchidas");
  });

  it("omite Cliente e/ou CNPJ vazios; some o bloco se ambos estiverem vazios", () => {
    const bothEmpty = buildQuotePdfHtml({
      kind: "cliente",
      items: blanks,
      conditions: EMPTY_QUOTE_CONDITIONS,
      summary: { totalKg: 2000, subtotal: 1000, ipi: 32.5, total: 1032.5, frete: 0 },
      client: { name: "", cnpj: "  " },
    });
    expect(bothEmpty).not.toContain('class="client-card');
    expect(bothEmpty).not.toContain(">Cliente<");
    expect(bothEmpty).not.toContain(">CNPJ<");

    const onlyName = buildQuotePdfHtml({
      kind: "cliente",
      items: blanks,
      conditions: EMPTY_QUOTE_CONDITIONS,
      summary: { totalKg: 2000, subtotal: 1000, ipi: 32.5, total: 1032.5, frete: 0 },
      client: { name: "ACME", cnpj: "" },
    });
    expect(onlyName).toContain("ACME");
    expect(onlyName).toContain(">Cliente<");
    expect(onlyName).not.toContain(">CNPJ<");
    expect(onlyName).toContain("client-card--single");

    const onlyCnpj = buildQuotePdfHtml({
      kind: "cliente",
      items: blanks,
      conditions: EMPTY_QUOTE_CONDITIONS,
      summary: { totalKg: 2000, subtotal: 1000, ipi: 32.5, total: 1032.5, frete: 0 },
      client: { name: "", cnpj: "12.345.678/0001-99" },
    });
    expect(onlyCnpj).toContain("12.345.678/0001-99");
    expect(onlyCnpj).toContain(">CNPJ<");
    expect(onlyCnpj).not.toContain(">Cliente<");
    expect(onlyCnpj).toContain("client-card--single");
  });

  it("colunas do PDF seguem o conteúdo, sem esticar pela página/cabeçalho", () => {
    const html = buildQuotePdfHtml({
      kind: "cliente",
      items: blanks,
      conditions: EMPTY_QUOTE_CONDITIONS,
      summary: { totalKg: 2000, subtotal: 1000, ipi: 32.5, total: 1032.5, frete: 0 },
      client: { name: "ACME", cnpj: "12.345.678/0001-99" },
    });
    expect(html).toContain("table-layout: auto");
    expect(html).not.toContain("table-layout: fixed");
    expect(html).toContain("width: max-content");
    expect(html).toContain("overflow: visible");
    expect(html).not.toContain("text-overflow: clip");
    // Evita o hack width:1% + table 100% que desalinhava cabeçalho e dados na impressão.
    expect(html).not.toMatch(/table\.items\s*\{[^}]*width:\s*100%/);
    expect(html).not.toContain("width: 1%");
  });

});
