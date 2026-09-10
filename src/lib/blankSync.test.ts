import { describe, expect, it } from "vitest";
import {
  blankUnitKg,
  resyncBlankDemand,
  slitterLengthFromWeight,
  slitterWeightFromLength,
  syncBlankFromQty,
  syncBlankFromWeight,
  syncSlitterFromQty,
  syncSlitterFromWeight,
} from "./blankSync";
import type { BlankInput, CoilInput } from "./types";

const coil: CoilInput = {
  width: 1250,
  thickness: 0.4,
  density: 8,
  kerf: 0,
  edgeTrim: 0,
};

const blank600: BlankInput = {
  id: "a",
  name: "600×470",
  width: 600,
  length: 470,
  minKg: 1000,
  minQty: 0,
};

describe("blankSync", () => {
  it("calcula peso unitário", () => {
    expect(blankUnitKg(blank600, coil)).toBeCloseTo(0.9024, 3);
  });

  it("sincroniza peso a partir da quantidade", () => {
    const synced = syncBlankFromQty(1109, blankUnitKg(blank600, coil));
    expect(synced.minQty).toBe(1109);
    expect(synced.minKg).toBeCloseTo(1000.8, 0);
  });

  it("sincroniza quantidade a partir do peso", () => {
    const unit = blankUnitKg(blank600, coil);
    const synced = syncBlankFromWeight(1000, unit);
    expect(synced.minQty).toBe(1109);
    expect(synced.minKg).toBe(1000);
  });

  it("recalcula ao mudar dimensões mantendo quantidade", () => {
    const start = { ...blank600, minQty: 100, minKg: 86.86 };
    const next = resyncBlankDemand({ ...start, width: 650 }, coil, "qty");
    expect(next.minQty).toBe(100);
    expect(next.minKg).toBeGreaterThan(start.minKg);
  });

  it("no SLITTER, peso determina comprimento sem alterar Qtd", () => {
    const item: BlankInput = {
      id: "s",
      name: "",
      itemKind: "slitter",
      width: 600,
      length: 0,
      minKg: 1000,
      minQty: 2,
    };
    const next = syncSlitterFromWeight(item, coil);
    expect(next.minQty).toBe(2);
    expect(next.length).toBe(slitterLengthFromWeight(item, coil));
    expect(next.length).toBeGreaterThan(0);
    // peso ≈ qtd * unit(length)
    expect(slitterWeightFromLength(next, coil)).toBeCloseTo(1000, 0);
  });

  it("no SLITTER, Qtd manual recalcula comprimento quando não há length", () => {
    const item: BlankInput = {
      id: "s",
      name: "",
      itemKind: "slitter",
      width: 600,
      length: 0,
      minKg: 1000,
      minQty: 1,
    };
    const withQty = syncSlitterFromQty({ ...item, minQty: 4 }, coil);
    expect(withQty.minQty).toBe(4);
    expect(withQty.minKg).toBe(1000);
    expect(withQty.length).toBe(slitterLengthFromWeight({ ...item, minQty: 4 }, coil));
    expect(withQty.length).toBeLessThan(slitterLengthFromWeight(item, coil));
  });

  it("resyncBlankDemand não altera Qtd de SLITTER", () => {
    const item: BlankInput = {
      id: "s",
      name: "",
      itemKind: "slitter",
      width: 600,
      length: 1000,
      minKg: 500,
      minQty: 3,
    };
    const next = resyncBlankDemand(item, coil, "weight");
    expect(next.minQty).toBe(3);
    expect(next.minKg).toBe(500);
  });
});
