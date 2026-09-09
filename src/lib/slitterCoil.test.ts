import { describe, expect, it } from "vitest";
import { coilFromSlitterItems } from "./slitterCoil";
import type { BlankInput } from "./types";

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
