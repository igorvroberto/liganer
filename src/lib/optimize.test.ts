import { describe, expect, it } from "vitest";
import { combinations, minSumWithCoverage, solveLinearSystem } from "./math";
import {
  generatePatterns,
  minPiecesForBlank,
  optimizeCutting,
  programLoss,
  stripTypesForBlank,
  unitWeightKg,
  usableWidth,
} from "./optimize";
import type { CalcInput } from "./types";

const exampleInput = (overrides: Partial<CalcInput["coil"]> = {}): CalcInput => ({
  coil: {
    width: 1250,
    thickness: 1,
    density: 7.93,
    kerf: 0,
    edgeTrim: 0,
    ...overrides,
  },
  blanks: [
    { id: "a", name: "600×470", width: 600, length: 470, minKg: 1000, minQty: 0 },
    { id: "b", name: "650×500", width: 650, length: 500, minKg: 1000, minQty: 0 },
  ],
});

describe("math", () => {
  it("resolve sistema linear 2x2", () => {
    const x = solveLinearSystem(
      [
        [2, 1],
        [1, 1],
      ],
      [5, 3],
    );
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(2);
    expect(x![1]).toBeCloseTo(1);
  });

  it("combinações", () => {
    expect(combinations(["a", "b", "c"], 2)).toEqual([
      ["a", "b"],
      ["a", "c"],
      ["b", "c"],
    ]);
  });

  it("minimiza comprimento cobrindo demanda", () => {
    const x = minSumWithCoverage(
      [
        [1 / 470, 1 / 500],
        [2 / 470, 0],
      ],
      [448, 389],
    );
    expect(x).not.toBeNull();
    expect(x![0]).toBeGreaterThan(0);
  });
});

describe("optimizeCutting — exemplo 600×470 e 650×500", () => {
  it("usa o padrão 600 + 650 na bobina de 1250 mm", () => {
    const result = optimizeCutting(exampleInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.yieldPercent).toBeGreaterThan(99);
    expect(result.programs.length).toBe(1);

    const widths = result.programs[0].pattern.strips.map((s) => s.stripWidth).sort((a, b) => a - b);
    expect(widths).toEqual([600, 650]);
    expect(result.programs[0].pattern.waste).toBeCloseTo(0);

    expect(result.products[0].pieces).toBe(448);
    expect(result.products[1].pieces).toBe(421);
    expect(result.products[0].weightKg).toBeGreaterThanOrEqual(1000);
    expect(result.products[1].weightKg).toBeGreaterThan(1080);
    expect(result.totalCoilLengthMm).toBeCloseTo(210560, 0);
  });

  it("garante pelo menos 1000 kg de cada blank", () => {
    const result = optimizeCutting(exampleInput());
    if (!result.ok) throw new Error(result.message);
    const weights = result.products.map((p) => p.weightKg);
    expect(Math.min(...weights)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...weights)).toBeGreaterThan(1000);
  });

  it("calcula peso unitário de inox 304", () => {
    const coil = exampleInput().coil;
    expect(unitWeightKg(600, 470, coil)).toBeCloseTo(2.23626, 4);
    expect(unitWeightKg(650, 500, coil)).toBeCloseTo(2.57725, 4);
  });

  it("arredonda peças para cobrir o peso mínimo", () => {
    const coil = exampleInput().coil;
    const unit = unitWeightKg(600, 470, coil);
    expect(minPiecesForBlank({ id: "a", name: "", width: 600, length: 470, minKg: 1000, minQty: 0 }, unit)).toBe(
      448,
    );
  });

  it("gera o casamento perfeito 600+650", () => {
    const types = [
      ...stripTypesForBlank(exampleInput().blanks[0], 0),
      ...stripTypesForBlank(exampleInput().blanks[1], 1),
    ];
    const patterns = generatePatterns(types, 1250, 0, 4);
    const perfect = patterns.find((p) => {
      const widths = p.strips.map((s) => s.stripWidth).sort((a, b) => a - b);
      return widths[0] === 600 && widths[1] === 650 && p.waste < 1e-6;
    });
    expect(perfect).toBeTruthy();
  });

  it("rejeita blank maior que a bobina nas duas orientações", () => {
    const result = optimizeCutting({
      ...exampleInput(),
      blanks: [{ id: "x", name: "X", width: 1300, length: 1300, minKg: 1000, minQty: 0 }],
    });
    expect(result.ok).toBe(false);
  });

  it("respeita a largura útil com refile", () => {
    expect(usableWidth({ width: 1250, thickness: 1, density: 7.93, kerf: 0, edgeTrim: 10 })).toBe(1230);
  });

  it("atende quantidade mínima em unidades", () => {
    const result = optimizeCutting({
      coil: exampleInput().coil,
      blanks: [{ id: "a", name: "600×470", width: 600, length: 470, minKg: 0, minQty: 100 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.products[0].pieces).toBeGreaterThanOrEqual(100);
  });

  it("lista alternativa com vários programas de corte", () => {
    const result = optimizeCutting(exampleInput());
    if (!result.ok) throw new Error(result.message);
    const multi = result.alternatives.find((alt) => alt.setupCount >= 2);
    expect(multi).toBeTruthy();
    expect(multi!.programs.length).toBeGreaterThanOrEqual(2);
  });

  it("monta plano 0,40 mm com densidade 8 e 4 blanks em 2 programas", () => {
    const result = optimizeCutting({
      coil: { width: 1250, thickness: 0.4, density: 8, kerf: 0, edgeTrim: 0 },
      blanks: [
        { id: "a", name: "600×470", width: 600, length: 470, minKg: 1000, minQty: 0 },
        { id: "b", name: "700×500", width: 700, length: 500, minKg: 1000, minQty: 0 },
        { id: "c", name: "750×550", width: 750, length: 550, minKg: 1000, minQty: 0 },
        { id: "d", name: "650×530", width: 650, length: 530, minKg: 1000, minQty: 0 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const best = result.alternatives[0];
    expect(best.setupCount).toBe(2);
    expect(best.yieldPercent).toBeGreaterThan(99.5);
    for (const product of best.products) {
      expect(product.weightKg).toBeGreaterThanOrEqual(1000 - 1e-6);
    }
    expect(best.products[0].pieces).toBe(1109);
    expect(best.products[2].pieces).toBe(758);
    const loss = programLoss(best.programs[0], {
      width: 1250,
      thickness: 0.4,
      density: 8,
      kerf: 0,
      edgeTrim: 0,
    });
    expect(loss.widthLossPercent).toBeCloseTo(0, 5);
    expect(loss.lossPercent).toBeGreaterThanOrEqual(0);
  });
});
