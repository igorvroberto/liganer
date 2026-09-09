import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyParsedPriceTable,
  lookupPriceFator100,
  parsePriceWorkbook,
  priceTableOptions,
  resetPriceTableToFallback,
} from "./priceTable";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("priceTable", () => {
  beforeEach(() => {
    resetPriceTableToFallback();
  });

  it("parseia a planilha e expõe tipo/acabamento/PVC/espessura", () => {
    const buf = readFileSync(join(root, "public/tabelas/precos-chapas-bobinas.xlsx"));
    const parsed = parsePriceWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    expect(parsed.rows.length).toBeGreaterThan(50);
    applyParsedPriceTable(parsed.rows, "test.xlsx", parsed.pvcColumns);

    const opts = priceTableOptions();
    expect(opts.tipo).toContain("304");
    expect(opts.acabamento).toContain("2B");
    expect(opts.acabamento).toContain("ESCOVADO");
    expect(opts.pvc.map((p) => p.value)).toEqual(["sem", "azul", "preto-branco", "preto", "nitto"]);
    expect(opts.espessura).toContain(0.5);
  });

  it("filtra acabamento e espessura pelo tipo", () => {
    const opts = priceTableOptions({ tipo: "201", acabamento: "2B" });
    expect(opts.acabamento.length).toBeGreaterThan(0);
    expect(opts.espessura).toContain(0.5);
  });

  it("busca preço fator 100 conforme PVC", () => {
    const base = { tipo: "201", acabamento: "2B", espessura: 0.5 };
    expect(lookupPriceFator100({ ...base, pvc: "sem" }).precoFator100).toBeCloseTo(30.70404, 5);
    expect(lookupPriceFator100({ ...base, pvc: "azul" }).precoFator100).toBeCloseTo(32.12388, 5);
    expect(lookupPriceFator100({ ...base, pvc: "preto-branco" }).precoFator100).toBeCloseTo(33.45498, 5);
    expect(lookupPriceFator100({ ...base, pvc: "preto" }).precoFator100).toBeCloseTo(34.96356, 5);
    expect(lookupPriceFator100({ ...base, pvc: "nitto" }).precoFator100).toBeCloseTo(36.02844, 5);
    expect(lookupPriceFator100({ ...base, pvc: "nitto" }).matched).toBe(true);
  });

  it("normaliza N4 como ESCOVADO na busca", () => {
    const result = lookupPriceFator100({
      tipo: "201",
      acabamento: "N4",
      espessura: 0.5,
      pvc: "nitto",
    });
    expect(result.matched).toBe(true);
    expect(result.precoFator100).toBeGreaterThan(0);
  });
});
