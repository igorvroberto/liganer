import { describe, expect, it } from "vitest";
import { groupBlanksByMaterialSpec, materialSpecKey } from "./materialGroups";
import { optimizeCutting } from "./optimize";
import type { BlankInput, CoilInput } from "./types";

const coil: CoilInput = {
  width: 1250,
  thickness: 0.4,
  density: 8,
  kerf: 0,
  edgeTrim: 5,
  allowOvershoot: true,
};

function blank(partial: Partial<BlankInput> & Pick<BlankInput, "id" | "width" | "length">): BlankInput {
  return {
    name: "",
    minKg: 1000,
    minQty: 0,
    itemKind: "blank",
    ...partial,
  };
}

describe("materialSpecKey / groups", () => {
  it("agrupa só itens com tipo/acabamento/PVC/espessura iguais", () => {
    const items = [
      blank({ id: "a", width: 600, length: 470, tipo: "304", acabamento: "2B", pvc: "sem", thickness: 0.4 }),
      blank({ id: "b", width: 650, length: 500, tipo: "304", acabamento: "2B", pvc: "sem", thickness: 0.4 }),
      blank({ id: "c", width: 600, length: 470, tipo: "201", acabamento: "2B", pvc: "sem", thickness: 0.4 }),
    ];
    expect(materialSpecKey(items[0])).toBe(materialSpecKey(items[1]));
    expect(materialSpecKey(items[0])).not.toBe(materialSpecKey(items[2]));
    const groups = groupBlanksByMaterialSpec(items);
    expect(groups).toHaveLength(2);
  });
});

describe("optimizeCutting — programas por especificação", () => {
  it("mantém itens compatíveis no mesmo plano quando cabe na bobina", () => {
    const result = optimizeCutting({
      coil,
      blanks: [
        blank({ id: "a", width: 600, length: 470, tipo: "304", acabamento: "2B", pvc: "sem", thickness: 0.4 }),
        blank({ id: "b", width: 650, length: 500, tipo: "304", acabamento: "2B", pvc: "sem", thickness: 0.4 }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 600+650 fecha 1250: pode ser 1 programa
    expect(result.programs.length).toBeGreaterThanOrEqual(1);
    expect(result.products).toHaveLength(2);
  });

  it("separa programas quando o tipo é diferente", () => {
    const result = optimizeCutting({
      coil,
      blanks: [
        blank({ id: "a", width: 600, length: 470, tipo: "304", acabamento: "2B", pvc: "sem", thickness: 0.4 }),
        blank({ id: "b", width: 650, length: 500, tipo: "201", acabamento: "2B", pvc: "sem", thickness: 0.4 }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.programs.length).toBeGreaterThanOrEqual(2);
    for (const program of result.programs) {
      const keys = new Set(
        program.pattern.strips.map((s) => {
          const b = result.products[s.productIndex].blank;
          return materialSpecKey(b);
        }),
      );
      expect(keys.size).toBe(1);
    }
  });

  it("separa programas quando PVC ou espessura diferem", () => {
    const result = optimizeCutting({
      coil,
      blanks: [
        blank({ id: "a", width: 600, length: 470, tipo: "304", acabamento: "2B", pvc: "sem", thickness: 0.4 }),
        blank({ id: "b", width: 650, length: 500, tipo: "304", acabamento: "2B", pvc: "azul", thickness: 0.4 }),
        blank({ id: "c", width: 600, length: 470, tipo: "304", acabamento: "2B", pvc: "sem", thickness: 0.5 }),
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.programs.length).toBeGreaterThanOrEqual(3);
  });
});
