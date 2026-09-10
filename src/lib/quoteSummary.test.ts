import { describe, expect, it } from "vitest";
import {
  IPI_RATE,
  applyFretePercent,
  itemCommercial,
  parseFretePercent,
  quoteSummary,
} from "./quoteSummary";
import type { BlankInput } from "./types";

const base = (partial: Partial<BlankInput>): BlankInput => ({
  id: "a",
  name: "",
  width: 600,
  length: 470,
  minKg: 0,
  minQty: 0,
  ...partial,
});

describe("parseFretePercent (paridade chapas)", () => {
  it("interpreta 1 como 1% (não 100%) — evita dobrar o preço", () => {
    expect(parseFretePercent("1")).toBeCloseTo(0.01, 10);
    expect(parseFretePercent(1)).toBeCloseTo(0.01, 10);
    expect(parseFretePercent("1,5")).toBeCloseTo(0.015, 10);
    expect(parseFretePercent("0,01")).toBeCloseTo(0.01, 10);
    expect(parseFretePercent("")).toBe(0);
  });

  it("1% aumenta 1%, não dobra", () => {
    expect(applyFretePercent(100, parseFretePercent("1"))).toBeCloseTo(101, 10);
    expect(applyFretePercent(100, 1)).toBeCloseTo(200, 10); // fração errada = bug
  });
});

describe("quoteSummary (paridade chapas-bobinas)", () => {
  it("zera totais sem preço", () => {
    const summary = quoteSummary([base({ minKg: 1000 })]);
    expect(summary).toEqual({
      totalKg: 0,
      subtotal: 0,
      ipi: 0,
      total: 0,
      frete: 0,
    });
  });

  it("soma kg só de itens com preço sem IPI e aplica IPI 3,25%", () => {
    const priced = base({
      id: "p",
      minKg: 1000,
      priceFactor100: 20,
      usedFactor: 100,
    });
    const noPrice = base({ id: "n", minKg: 500 });
    const commercial = itemCommercial(priced);
    expect(commercial.priceWithoutIpi).toBe(20);
    expect(commercial.subtotal).toBe(20_000);

    const summary = quoteSummary([priced, noPrice]);
    expect(summary.totalKg).toBe(1000);
    expect(summary.subtotal).toBe(20_000);
    expect(summary.ipi).toBeCloseTo(20_000 * IPI_RATE, 6);
    expect(summary.total).toBeCloseTo(20_000 * (1 + IPI_RATE), 6);
    expect(summary.frete).toBe(0);
  });

  it("aplica acréscimo de perda longitudinal no preço total e no subtotal", () => {
    const priced = base({
      id: "p",
      minKg: 100,
      priceFactor100: 10,
      usedFactor: 100,
    });
    // 40 mm < 100 → acréscimo = 5%
    const commercial = itemCommercial(priced, { perdaMm: 40, perdaPct: 5 });
    expect(commercial.acrescimoPerda).toBeCloseTo(5, 6);
    expect(commercial.totalPrice).toBeCloseTo(10.5, 6);
    expect(commercial.subtotal).toBeCloseTo(1050, 6);

    const summary = quoteSummary([priced], { p: { perdaMm: 40, perdaPct: 5 } });
    expect(summary.subtotal).toBeCloseTo(1050, 6);
  });

  it("aplica Frete (%) no preço total e no preço sem IPI", () => {
    const priced = base({
      id: "p",
      minKg: 100,
      priceFactor100: 10,
      usedFactor: 100,
    });
    const withFrete = itemCommercial(priced, null, parseFretePercent("1"));
    expect(withFrete.totalPrice).toBeCloseTo(10.1, 6);
    expect(withFrete.priceWithoutIpi).toBeCloseTo(10.1, 6);
    expect(withFrete.subtotal).toBeCloseTo(1010, 6);

    const summary = quoteSummary([priced], {}, "1");
    expect(summary.frete).toBeCloseTo(0.01, 10);
    expect(summary.subtotal).toBeCloseTo(1010, 6);
  });
});
