import { describe, expect, it } from "vitest";
import { fmtDecimal2, fmtThickness, parseDecimalBr2, parseThickness, round2 } from "./format";

describe("espessura", () => {
  it("formata sempre com duas casas e vírgula", () => {
    expect(fmtThickness(0.4)).toBe("0,40");
    expect(fmtThickness(1)).toBe("1,00");
    expect(fmtThickness(0.45)).toBe("0,45");
  });

  it("aceita vírgula ou ponto na digitação", () => {
    expect(parseThickness("0,40")).toBe(0.4);
    expect(parseThickness("0.40")).toBe(0.4);
    expect(parseThickness("")).toBeNull();
  });
});

describe("fator 100 (2 casas)", () => {
  it("arredonda e formata com duas casas", () => {
    expect(round2(30.70404)).toBe(30.7);
    expect(fmtDecimal2(30.7)).toBe("30,70");
    expect(fmtDecimal2(45)).toBe("45,00");
  });

  it("parse rejeita mais de duas casas", () => {
    expect(parseDecimalBr2("30,70")).toBe(30.7);
    expect(parseDecimalBr2("30,704")).toBeNull();
    expect(parseDecimalBr2("")).toBeNull();
  });
});
