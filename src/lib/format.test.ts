import { describe, expect, it } from "vitest";
import {
  fmtDecimal2,
  fmtPct,
  fmtPlainInt,
  fmtPlainMm,
  fmtThickness,
  parseDecimalBr2,
  parseThickness,
  round2,
} from "./format";

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

describe("dimensões PDF sem milhar", () => {
  it("formata mm e inteiros sem separador de milhar", () => {
    expect(fmtPlainInt(1250)).toBe("1250");
    expect(fmtPlainInt(1000)).toBe("1000");
    expect(fmtPlainMm(1250)).toBe("1250 mm");
    expect(fmtPlainMm(1042.4)).toBe("1042,4 mm");
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

describe("percentuais (2 casas)", () => {
  it("formata perda %, acréscimo e aproveitamento com duas casas", () => {
    expect(fmtPct(5)).toBe("5,00%");
    expect(fmtPct(3.2)).toBe("3,20%");
    expect(fmtPct(97.456)).toBe("97,46%");
  });
});
