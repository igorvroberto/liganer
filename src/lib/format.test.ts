import { describe, expect, it } from "vitest";
import { fmtThickness, parseThickness } from "./format";

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
