import { describe, expect, it } from "vitest";
import { blankUnitKg, resyncBlankDemand, syncBlankFromQty, syncBlankFromWeight } from "./blankSync";
import type { BlankInput, CoilInput } from "./types";

const coil: CoilInput = {
  width: 1250,
  thickness: 0.4,
  density: 7.7,
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
    expect(blankUnitKg(blank600, coil)).toBeCloseTo(0.8686, 3);
  });

  it("sincroniza peso a partir da quantidade", () => {
    const synced = syncBlankFromQty(1152, blankUnitKg(blank600, coil));
    expect(synced.minQty).toBe(1152);
    expect(synced.minKg).toBeCloseTo(1000.6, 0);
  });

  it("sincroniza quantidade a partir do peso", () => {
    const unit = blankUnitKg(blank600, coil);
    const synced = syncBlankFromWeight(1000, unit);
    expect(synced.minQty).toBe(1152);
    expect(synced.minKg).toBe(1000);
  });

  it("recalcula ao mudar dimensões mantendo quantidade", () => {
    const start = { ...blank600, minQty: 100, minKg: 86.86 };
    const next = resyncBlankDemand({ ...start, width: 650 }, coil, "qty");
    expect(next.minQty).toBe(100);
    expect(next.minKg).toBeGreaterThan(start.minKg);
  });
});
