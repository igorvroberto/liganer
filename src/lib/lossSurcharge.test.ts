import { describe, expect, it } from "vitest";
import { acrescimoPerdaPct, applyLossSurcharge } from "./lossSurcharge";

describe("lossSurcharge", () => {
  it("perda mm < 100 usa a perda % integral", () => {
    expect(acrescimoPerdaPct(40, 3.2)).toBeCloseTo(3.2, 6);
    expect(applyLossSurcharge(10, 40, 3.2)).toBeCloseTo(10 * 1.032, 6);
  });

  it("perda mm entre 100 e 300 usa perda % × 0,30", () => {
    expect(acrescimoPerdaPct(150, 10)).toBeCloseTo(3, 6);
    expect(applyLossSurcharge(10, 150, 10)).toBeCloseTo(10.3, 6);
  });

  it("perda mm ≥ 300 usa perda % × 0,20", () => {
    expect(acrescimoPerdaPct(300, 10)).toBeCloseTo(2, 6);
    expect(acrescimoPerdaPct(400, 10)).toBeCloseTo(2, 6);
  });
});
