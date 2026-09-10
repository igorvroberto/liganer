import { describe, expect, it } from "vitest";
import { IPI_RATE, itemCommercial, quoteSummary } from "./quoteSummary";
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
});
