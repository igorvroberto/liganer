import { describe, expect, it } from "vitest";
import { coilForProgram, coilFromSlitterItems } from "./slitterCoil";
import type { BlankInput, CoilInput, ProgramResult } from "./types";

describe("coilFromSlitterItems", () => {
  it("usa largura e espessura do primeiro item preenchido", () => {
    const items: BlankInput[] = [
      {
        id: "1",
        name: "",
        width: 600,
        length: 470,
        minKg: 1000,
        minQty: 0,
        coilWidth: 1250,
        thickness: 0.4,
        line: "304 2B",
        pvc: "azul",
        priceFactor100: 45,
        usedFactor: 170,
      },
      {
        id: "2",
        name: "",
        width: 650,
        length: 0,
        minKg: 500,
        minQty: 0,
        itemKind: "slitter",
        coilWidth: 1500,
        thickness: 0.5,
      },
    ];
    const coil = coilFromSlitterItems(items, true);
    expect(coil.width).toBe(1250);
    expect(coil.thickness).toBe(0.4);
    expect(coil.line).toBe("304 2B");
    expect(coil.pvc).toBe("azul");
    expect(coil.priceFactor100).toBe(45);
    expect(coil.usedFactor).toBe(170);
    expect(coil.allowOvershoot).toBe(true);
    expect(coil.edgeTrim).toBe(5);
  });
});

describe("coilForProgram", () => {
  const baseCoil: CoilInput = {
    width: 1250,
    thickness: 0.5,
    density: 8,
    kerf: 0,
    edgeTrim: 5,
    allowOvershoot: true,
  };

  it("usa a espessura dos itens do programa, não a bobina global", () => {
    const products = [
      {
        blank: {
          id: "a",
          name: "",
          width: 300,
          length: 800,
          minKg: 0,
          minQty: 1000,
          coilWidth: 1250,
          thickness: 0.5,
          line: "410S BA",
          pvc: "nao",
        } satisfies BlankInput,
      },
      {
        blank: {
          id: "b",
          name: "",
          width: 300,
          length: 800,
          minKg: 0,
          minQty: 1000,
          coilWidth: 1250,
          thickness: 0.6,
          line: "410S BA",
          pvc: "nao",
        } satisfies BlankInput,
      },
    ];
    const program: ProgramResult = {
      coilLengthMm: 1_042_400,
      pattern: {
        strips: [{ productIndex: 1, stripWidth: 300, cutLength: 800, rotated: false, stripCount: 4 }],
        waste: 40,
      },
      piecesPerProduct: [0, 5212],
      weightPerProductKg: [0, 6004.2],
      totalWeight: 6004.2,
    };

    const programCoil = coilForProgram(program, products, baseCoil);
    expect(programCoil.thickness).toBe(0.6);
    expect(programCoil.width).toBe(1250);

    // Peso físico com 0,60 — não o valor errado com 0,50 (= 5212 Kg)
    const physical =
      (programCoil.width * program.coilLengthMm * programCoil.thickness * programCoil.density) /
      1_000_000;
    expect(physical).toBeCloseTo(6254.4, 1);
    expect(physical).toBeGreaterThan(6004);
  });
});
