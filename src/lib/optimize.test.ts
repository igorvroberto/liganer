import { describe, expect, it } from "vitest";
import { combinations, minSumWithCoverage, solveLinearSystem } from "./math";
import {
  generatePatterns,
  groupIdenticalStrips,
  lossBreakdown,
  minPiecesForBlank,
  optimizeCutting,
  programLoss,
  stripTypesForBlank,
  unitWeightKg,
  usableWidth,
} from "./optimize";
import type { CalcInput, Strip } from "./types";

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

  it("exclui refile e perda transversal do aproveitamento", () => {
    const result = optimizeCutting({
      coil: { width: 1250, thickness: 0.4, density: 8, kerf: 0, edgeTrim: 10 },
      blanks: [{ id: "a", name: "600×470", width: 600, length: 470, minKg: 1000, minQty: 0 }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const plan = result.alternatives[0];
    const breakdown = lossBreakdown(plan.programs, plan.usefulWeightKg, {
      width: 1250,
      thickness: 0.4,
      density: 8,
      kerf: 0,
      edgeTrim: 10,
    });

    expect(breakdown.refileKg).toBeGreaterThan(0);
    expect(plan.yieldPercent).toBeCloseTo(breakdown.yieldPercent, 5);
    expect(plan.scrapKg).toBeCloseTo(breakdown.scrapKg, 5);
    // Base = largura total; só a sobra longitudinal reduz o %.
    expect(plan.yieldPercent).toBeCloseTo(100 - breakdown.longitudinalPct, 5);
    expect(plan.coilWeightKg).toBeCloseTo(breakdown.physicalCoilKg, 5);
    expect(breakdown.longitudinalPct).toBeCloseTo(
      (breakdown.scrapKg / breakdown.physicalCoilKg) * 100,
      5,
    );
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

  it("aceita item SLITTER só com largura (sem comprimento)", () => {
    const result = optimizeCutting({
      coil: { width: 1250, thickness: 0.4, density: 8, kerf: 0, edgeTrim: 0 },
      blanks: [
        {
          id: "s1",
          name: "slitter 600",
          itemKind: "slitter",
          width: 600,
          length: 0,
          minKg: 1000,
          minQty: 0,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.products[0].weightKg).toBeGreaterThanOrEqual(1000 - 1e-6);
    expect(result.programs[0].pattern.strips[0].stripWidth).toBe(600);
    expect(result.programs[0].pattern.strips[0].cutLength).toBe(1);
  });

  it("aceita item SLITTER com comprimento opcional preenchido", () => {
    const result = optimizeCutting({
      coil: { width: 1250, thickness: 0.4, density: 8, kerf: 0, edgeTrim: 0 },
      blanks: [
        {
          id: "s2",
          name: "slitter 600x2000",
          itemKind: "slitter",
          width: 600,
          length: 2000,
          minKg: 1000,
          minQty: 0,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.programs[0].pattern.strips[0].cutLength).toBe(1);
    expect(result.products[0].weightKg).toBeGreaterThanOrEqual(1000 - 1e-6);
  });

  it("exige comprimento para item BLANK", () => {
    const result = optimizeCutting({
      coil: { width: 1250, thickness: 0.4, density: 8, kerf: 0, edgeTrim: 0 },
      blanks: [
        {
          id: "b1",
          name: "blank sem comprimento",
          itemKind: "blank",
          width: 600,
          length: 0,
          minKg: 1000,
          minQty: 0,
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("não ultrapassa o peso quando allowOvershoot é falso", () => {
    const coil = { width: 1250, thickness: 0.4, density: 8, kerf: 0, edgeTrim: 0, allowOvershoot: false };
    const result = optimizeCutting({
      coil,
      blanks: [
        { id: "a", name: "600×470", width: 600, length: 470, minKg: 1000, minQty: 0 },
        { id: "b", name: "700×500", width: 700, length: 500, minKg: 1000, minQty: 0 },
        { id: "c", name: "750×550", width: 750, length: 550, minKg: 1000, minQty: 0 },
        { id: "d", name: "650×530", width: 650, length: 530, minKg: 1000, minQty: 0 },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const product of result.alternatives[0].products) {
      expect(product.weightKg).toBeLessThanOrEqual(1000 + 1e-6);
    }
  });

  it("reduz comprimento e peso necessário quando allowOvershoot passa a falso", () => {
    const blanks = [
      {
        id: "1",
        name: "",
        width: 300,
        length: 800,
        minKg: 6000,
        minQty: 5209,
        coilWidth: 1250,
        thickness: 0.6,
      },
    ];
    const base = { width: 1250, thickness: 0.6, density: 8, kerf: 0, edgeTrim: 5 };
    const withOvershoot = optimizeCutting({ coil: { ...base, allowOvershoot: true }, blanks });
    const withoutOvershoot = optimizeCutting({ coil: { ...base, allowOvershoot: false }, blanks });
    expect(withOvershoot.ok).toBe(true);
    expect(withoutOvershoot.ok).toBe(true);
    if (!withOvershoot.ok || !withoutOvershoot.ok) return;

    const planYes = withOvershoot.alternatives[0];
    const planNo = withoutOvershoot.alternatives[0];
    expect(planNo.products[0].pieces).toBeLessThan(planYes.products[0].pieces);
    expect(planNo.products[0].weightKg).toBeLessThanOrEqual(6000 + 1e-6);
    expect(planNo.totalCoilLengthMm).toBeLessThan(planYes.totalCoilLengthMm);
    expect(planNo.coilWeightKg).toBeLessThan(planYes.coilWeightKg);
    // Comprimento alinhado a cortes inteiros (sem resto de ~799 mm no peso).
    expect(planNo.programs[0].remainderMmPerStrip.every((r) => r < 1e-6)).toBe(true);
    expect(planYes.programs[0].remainderMmPerStrip.every((r) => r < 1e-6)).toBe(true);
  });

  it("empacota 10 tiras de 122 mm em bobina 1250 com refile 5+5 (útil 1240)", () => {
    const coil = { width: 1250, thickness: 0.4, density: 8, kerf: 0, edgeTrim: 5 };
    expect(usableWidth(coil)).toBe(1240);
    const result = optimizeCutting({
      coil,
      blanks: [
        {
          id: "s122",
          name: "",
          itemKind: "slitter",
          width: 122,
          length: 0,
          minKg: 1000,
          minQty: 0,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const best = result.alternatives[0].programs
      .map((p) => p.pattern)
      .sort((a, b) => a.waste - b.waste)[0];
    expect(best.strips).toHaveLength(10);
    expect(best.strips.every((s) => s.stripWidth === 122)).toBe(true);
    expect(best.usedWidth).toBe(1220);
    expect(best.waste).toBe(20);
  });

  it("empacota 12 tiras de 100 mm priorizando a largura (slitter 3000 Kg)", () => {
    const coil = { width: 1250, thickness: 0.4, density: 8, kerf: 0, edgeTrim: 5, allowOvershoot: true };
    const result = optimizeCutting({
      coil,
      blanks: [
        {
          id: "s100",
          name: "",
          itemKind: "slitter",
          width: 100,
          length: 9_375_000,
          minKg: 3000,
          minQty: 1,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const best = result.alternatives[0].programs[0].pattern;
    expect(best.strips).toHaveLength(12);
    expect(best.usedWidth).toBe(1200);
    expect(best.waste).toBe(40);
    expect(result.alternatives[0].yieldPercent).toBeGreaterThan(95);
  });

  it("agrupa cortes idênticos e conta ocorrências", () => {
    const strips: Strip[] = [
      { productIndex: 0, stripWidth: 800, cutLength: 100, rotated: false },
      { productIndex: 0, stripWidth: 100, cutLength: 800, rotated: true },
      { productIndex: 0, stripWidth: 100, cutLength: 800, rotated: true },
      { productIndex: 0, stripWidth: 100, cutLength: 800, rotated: true },
      { productIndex: 0, stripWidth: 100, cutLength: 800, rotated: true },
    ];
    const grouped = groupIdenticalStrips(strips);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({ stripWidth: 800, cutLength: 100, stripCount: 1 });
    expect(grouped[1]).toMatchObject({ stripWidth: 100, cutLength: 800, rotated: true, stripCount: 4 });
  });
});
