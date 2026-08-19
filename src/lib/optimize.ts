import { combinations, minSumWithCoverage } from "./math";
import type {
  BlankInput,
  CalcError,
  CalcInput,
  CalcResult,
  CoilInput,
  Pattern,
  ProductResult,
  ProgramResult,
  RankedPlan,
  Strip,
} from "./types";

const MM_TO_KG = 1_000_000;
const LENGTH_EPS = 1e-6;

export function unitWeightKg(width: number, length: number, coil: CoilInput): number {
  return (width * length * coil.thickness * coil.density) / MM_TO_KG;
}

export function coilWeightKg(coilLengthMm: number, coil: CoilInput): number {
  return (coil.width * coilLengthMm * coil.thickness * coil.density) / MM_TO_KG;
}

export function programLoss(program: ProgramResult, coil: CoilInput) {
  const coilKg = coilWeightKg(program.coilLengthMm, coil);
  const usefulKg = program.weightPerProductKg.reduce((sum, kg) => sum + kg, 0);
  const scrapKg = Math.max(0, coilKg - usefulKg);
  const lossPercent = coilKg > 0 ? (scrapKg / coilKg) * 100 : 0;
  const widthWasteMm = program.pattern.waste;
  const widthLossPercent = coil.width > 0 ? (widthWasteMm / coil.width) * 100 : 0;
  return { coilKg, usefulKg, scrapKg, lossPercent, widthWasteMm, widthLossPercent };
}

export function minPiecesForBlank(blank: BlankInput, unitKg: number): number {
  const fromKg = blank.minKg > 0 && unitKg > 0 ? Math.ceil(blank.minKg / unitKg - 1e-9) : 0;
  return Math.max(fromKg, Math.max(0, Math.floor(blank.minQty)) || 0);
}

export function maxPiecesForBlank(blank: BlankInput, unitKg: number): number {
  const fromKg = blank.minKg > 0 && unitKg > 0 ? Math.floor(blank.minKg / unitKg + 1e-9) : 0;
  const fromQty = Math.max(0, Math.floor(blank.minQty)) || 0;
  if (fromKg > 0 && fromQty > 0) return Math.min(fromKg, fromQty);
  return Math.max(fromKg, fromQty);
}

export function targetPiecesForBlank(blank: BlankInput, unitKg: number, allowOvershoot: boolean): number {
  return allowOvershoot ? minPiecesForBlank(blank, unitKg) : maxPiecesForBlank(blank, unitKg);
}

function overshootAllowed(coil: CoilInput): boolean {
  return coil.allowOvershoot !== false;
}

export function usableWidth(coil: CoilInput): number {
  return coil.width - 2 * coil.edgeTrim;
}

export function stripTypesForBlank(blank: BlankInput, productIndex: number): Strip[] {
  const types: Strip[] = [
    {
      productIndex,
      stripWidth: blank.width,
      cutLength: blank.length,
      rotated: false,
    },
  ];
  if (Math.abs(blank.width - blank.length) > 1e-9) {
    types.push({
      productIndex,
      stripWidth: blank.length,
      cutLength: blank.width,
      rotated: true,
    });
  }
  return types;
}

function patternKey(strips: Strip[]): string {
  const counts = new Map<string, number>();
  for (const s of strips) {
    const key = `${s.productIndex}:${s.rotated ? 1 : 0}:${s.stripWidth}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}×${count}`)
    .join("|");
}

export function generatePatterns(
  stripTypes: Strip[],
  usable: number,
  kerf: number,
  maxStrips = 6,
): Pattern[] {
  const results = new Map<string, Pattern>();
  const current: Strip[] = [];

  const fit = (remaining: number, type: Strip, hasStrip: boolean) => {
    const extra = hasStrip ? kerf : 0;
    return type.stripWidth + extra <= remaining + 1e-9;
  };

  const consume = (remaining: number, type: Strip, hasStrip: boolean) => {
    const extra = hasStrip ? kerf : 0;
    return remaining - type.stripWidth - extra;
  };

  const save = (remaining: number) => {
    if (current.length === 0) return;
    const key = patternKey(current);
    const waste = remaining;
    const existing = results.get(key);
    if (existing && existing.waste <= waste + 1e-9) return;
    results.set(key, {
      strips: current.map((s) => ({ ...s })),
      usedWidth: usable - remaining,
      waste,
    });
  };

  const dfs = (remaining: number) => {
    save(remaining);
    if (current.length >= maxStrips) return;
    for (const type of stripTypes) {
      if (!fit(remaining, type, current.length > 0)) continue;
      current.push(type);
      dfs(consume(remaining, type, current.length > 1));
      current.pop();
    }
  };

  dfs(usable);
  return [...results.values()].sort((a, b) => a.waste - b.waste || a.strips.length - b.strips.length);
}

export function piecesPerMm(pattern: Pattern, productCount: number): number[] {
  const rate = Array.from({ length: productCount }, () => 0);
  for (const strip of pattern.strips) {
    rate[strip.productIndex] += 1 / strip.cutLength;
  }
  return rate;
}

function piecesFromLength(pattern: Pattern, coilLengthMm: number, productCount: number): number[] {
  const pieces = Array.from({ length: productCount }, () => 0);
  for (const strip of pattern.strips) {
    pieces[strip.productIndex] += Math.floor((coilLengthMm + LENGTH_EPS) / strip.cutLength);
  }
  return pieces;
}

function remainders(pattern: Pattern, coilLengthMm: number): number[] {
  return pattern.strips.map((strip) => {
    const n = Math.floor((coilLengthMm + LENGTH_EPS) / strip.cutLength);
    return Math.max(0, coilLengthMm - n * strip.cutLength);
  });
}

function minLengthForPattern(pattern: Pattern, nMin: number[]): number {
  const n = nMin.length;
  const rate = piecesPerMm(pattern, n);
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    if (nMin[i] <= 0) continue;
    if (rate[i] <= 1e-15) return Infinity;
    hi = Math.max(hi, (nMin[i] / rate[i]) * 2 + 10_000);
  }
  if (hi === 0) return 0;

  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    const pieces = piecesFromLength(pattern, mid, n);
    const ok = nMin.every((need, i) => need <= 0 || pieces[i] >= need);
    if (ok) hi = mid;
    else lo = mid;
  }
  return hi;
}

function maxLengthForPattern(pattern: Pattern, nMax: number[]): number {
  const n = nMax.length;
  const rate = piecesPerMm(pattern, n);
  let hi = 0;
  for (let i = 0; i < n; i++) {
    if (rate[i] <= 1e-15) continue;
    if (nMax[i] <= 0) return 0;
    hi = Math.max(hi, nMax[i] * (1 / rate[i]) + 10_000);
  }
  if (hi === 0) return 0;

  let lo = 0;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    const pieces = piecesFromLength(pattern, mid, n);
    const ok = pieces.every((qty, i) => rate[i] <= 1e-15 || qty <= nMax[i]);
    if (ok) lo = mid;
    else hi = mid;
  }
  return lo;
}

function capLengthsToMax(patterns: Pattern[], lengths: number[], nMax: number[]): number[] {
  const next = [...lengths];
  const n = nMax.length;

  for (let guard = 0; guard < 80; guard++) {
    const produced = Array.from({ length: n }, () => 0);
    for (let j = 0; j < patterns.length; j++) {
      if (next[j] <= LENGTH_EPS) continue;
      piecesFromLength(patterns[j], next[j], n).forEach((qty, i) => {
        produced[i] += qty;
      });
    }

    let over = -1;
    for (let i = 0; i < n; i++) {
      if (produced[i] > nMax[i]) {
        over = i;
        break;
      }
    }
    if (over < 0) break;

    let bestJ = -1;
    let bestRate = 0;
    for (let j = 0; j < patterns.length; j++) {
      if (next[j] <= LENGTH_EPS) continue;
      const rate = piecesPerMm(patterns[j], n)[over];
      if (rate > bestRate) {
        bestRate = rate;
        bestJ = j;
      }
    }
    if (bestJ < 0 || bestRate <= 0) break;

    const excess = produced[over] - nMax[over];
    next[bestJ] = Math.max(0, next[bestJ] - excess / bestRate);
  }

  return next;
}

function productResults(
  blanks: BlankInput[],
  coil: CoilInput,
  pieces: number[],
  nMin: number[],
): ProductResult[] {
  return blanks.map((blank, i) => {
    const unit = unitWeightKg(blank.width, blank.length, coil);
    return {
      blank,
      unitWeightKg: unit,
      minPieces: nMin[i],
      pieces: pieces[i],
      weightKg: pieces[i] * unit,
    };
  });
}

function toPrograms(
  chosen: { pattern: Pattern; lengthMm: number }[],
  productCount: number,
): ProgramResult[] {
  return chosen
    .filter((c) => c.lengthMm > 0.5)
    .map((c) => ({
      pattern: c.pattern,
      coilLengthMm: c.lengthMm,
      piecesPerProduct: piecesFromLength(c.pattern, c.lengthMm, productCount),
      weightPerProductKg: [],
      remainderMmPerStrip: remainders(c.pattern, c.lengthMm),
    }));
}

function fillProgramWeights(programs: ProgramResult[], blanks: BlankInput[], coil: CoilInput) {
  for (const program of programs) {
    program.weightPerProductKg = program.piecesPerProduct.map((qty, i) => {
      const blank = blanks[i];
      return qty * unitWeightKg(blank.width, blank.length, coil);
    });
  }
}

function planFromPrograms(
  label: string,
  programs: ProgramResult[],
  blanks: BlankInput[],
  coil: CoilInput,
  nTarget: number[],
): RankedPlan | null {
  if (programs.length === 0) return null;
  fillProgramWeights(programs, blanks, coil);

  const pieces = Array.from({ length: blanks.length }, () => 0);
  for (const program of programs) {
    program.piecesPerProduct.forEach((qty, i) => {
      pieces[i] += qty;
    });
  }

  const allow = overshootAllowed(coil);
  if (allow && nTarget.some((need, i) => pieces[i] < need)) return null;
  if (!allow && nTarget.some((max, i) => pieces[i] > max)) return null;

  const products = productResults(blanks, coil, pieces, nTarget);
  const totalCoilLengthMm = programs.reduce((s, p) => s + p.coilLengthMm, 0);
  const coilKg = coilWeightKg(totalCoilLengthMm, coil);
  const usefulKg = products.reduce((s, p) => s + p.weightKg, 0);
  const targetKg = blanks.reduce((s, b, i) => {
    const fromPieces = nTarget[i] * products[i].unitWeightKg;
    return s + (b.minKg > 0 ? Math.min(b.minKg, fromPieces) || fromPieces : fromPieces);
  }, 0);
  const overshootKg = allow ? Math.max(0, usefulKg - targetKg) : 0;
  const shortfallKg = allow ? 0 : Math.max(0, targetKg - usefulKg);

  return {
    label,
    yieldPercent: coilKg > 0 ? (usefulKg / coilKg) * 100 : 0,
    coilWeightKg: coilKg,
    usefulWeightKg: usefulKg,
    scrapKg: Math.max(0, coilKg - usefulKg),
    totalCoilLengthMm,
    programs,
    products,
    setupCount: programs.length,
    overshootKg,
    shortfallKg,
  };
}

function planLabel(programs: ProgramResult[], blanks: BlankInput[]): string {
  if (programs.length === 1) {
    return `1 programa · ${patternLabel(programs[0].pattern, blanks)}`;
  }
  return programs.map((p, i) => `P${i + 1}: ${patternLabel(p.pattern, blanks)}`).join(" · ");
}

function buildSequentialPlan(
  candidates: Pattern[],
  nTarget: number[],
  blanks: BlankInput[],
  coil: CoilInput,
): RankedPlan | null {
  const allow = overshootAllowed(coil);
  const remaining = [...nTarget];
  const chosen: { pattern: Pattern; lengthMm: number }[] = [];
  const maxPrograms = Math.max(8, nTarget.filter((v) => v > 0).length * 2);

  while (remaining.some((r) => r > 0) && chosen.length < maxPrograms) {
    let best: { pattern: Pattern; length: number; gain: number } | null = null;

    for (const pattern of candidates) {
      const rate = piecesPerMm(pattern, nTarget.length);
      if (!remaining.some((need, i) => need > 0 && rate[i] > 0)) continue;

      const length = allow
        ? minLengthForPattern(
            pattern,
            remaining.map((need, i) => (rate[i] > 0 ? need : 0)),
          )
        : maxLengthForPattern(pattern, remaining);
      if (!Number.isFinite(length) || length <= 0) continue;

      const pieces = piecesFromLength(pattern, length, nTarget.length);
      const gain = pieces.reduce((sum, qty, i) => {
        if (remaining[i] <= 0 || qty <= 0) return sum;
        const unit = unitWeightKg(blanks[i].width, blanks[i].length, coil);
        return sum + Math.min(qty, remaining[i]) * unit;
      }, 0);

      if (gain <= 0) continue;
      if (!best || gain / length > best.gain / best.length) {
        best = { pattern, length, gain };
      }
    }

    if (!best) break;

    chosen.push({ pattern: best.pattern, lengthMm: best.length });
    const produced = piecesFromLength(best.pattern, best.length, nTarget.length);
    produced.forEach((qty, i) => {
      remaining[i] = Math.max(0, remaining[i] - qty);
    });
  }

  if (allow && remaining.some((r) => r > 0)) return null;
  const programs = toPrograms(chosen, nTarget.length);
  return planFromPrograms(planLabel(programs, blanks), programs, blanks, coil, nTarget);
}

function patternLabel(pattern: Pattern, blanks: BlankInput[]): string {
  return pattern.strips
    .map((strip) => {
      const blank = blanks[strip.productIndex];
      const w = strip.stripWidth;
      const l = strip.cutLength;
      const name = `${blank.width}×${blank.length}`;
      return `${name} ${w}×${l}${strip.rotated ? " girado" : ""}`;
    })
    .join(" + ");
}

function bumpLengthsToIntegerPieces(
  patterns: Pattern[],
  lengths: number[],
  nMin: number[],
): number[] {
  const next = [...lengths];
  const n = nMin.length;

  for (let guard = 0; guard < 40; guard++) {
    const produced = Array.from({ length: n }, () => 0);
    for (let j = 0; j < patterns.length; j++) {
      if (next[j] <= LENGTH_EPS) continue;
      const pieces = piecesFromLength(patterns[j], next[j], n);
      pieces.forEach((qty, i) => {
        produced[i] += qty;
      });
    }

    let short = -1;
    for (let i = 0; i < n; i++) {
      if (produced[i] < nMin[i]) {
        short = i;
        break;
      }
    }
    if (short < 0) break;

    let bestJ = -1;
    let bestRate = 0;
    for (let j = 0; j < patterns.length; j++) {
      const rate = piecesPerMm(patterns[j], n)[short];
      if (rate > bestRate) {
        bestRate = rate;
        bestJ = j;
      }
    }
    if (bestJ < 0 || bestRate <= 0) break;

    const need = nMin[short] - produced[short];
    next[bestJ] += need / bestRate + 1e-6;
  }

  return next;
}

function filterPatterns(patterns: Pattern[], nMin: number[], maxKeep = 36): Pattern[] {
  const n = nMin.length;
  const useful = patterns.filter((p) => {
    const rate = piecesPerMm(p, n);
    return nMin.some((need, i) => need > 0 && rate[i] > 0);
  });

  const dedicated: Pattern[] = [];
  for (let i = 0; i < n; i++) {
    if (nMin[i] <= 0) continue;
    const only = useful
      .filter((p) => {
        const rate = piecesPerMm(p, n);
        return rate[i] > 0 && rate.every((r, idx) => idx === i || r <= 1e-15 || nMin[idx] <= 0);
      })
      .sort((a, b) => a.waste - b.waste);
    if (only[0]) dedicated.push(only[0]);
    const bestForI = [...useful]
      .filter((p) => piecesPerMm(p, n)[i] > 0)
      .sort((a, b) => {
        const ra = piecesPerMm(a, n)[i] * (1 - a.waste / (a.usedWidth + a.waste + 1e-9));
        const rb = piecesPerMm(b, n)[i] * (1 - b.waste / (b.usedWidth + b.waste + 1e-9));
        return rb - ra;
      });
    if (bestForI[0]) dedicated.push(bestForI[0]);
  }

  const mixed = useful.filter((p) => {
    const rate = piecesPerMm(p, n);
    const covers = nMin.filter((need, i) => need > 0 && rate[i] > 0).length;
    return covers >= 2;
  });

  const ranked = [...new Set([...dedicated, ...mixed, ...useful.slice(0, 12)])];
  return ranked.slice(0, maxKeep);
}

function evaluateSubset(
  subset: Pattern[],
  nTarget: number[],
  blanks: BlankInput[],
  coil: CoilInput,
): RankedPlan | null {
  const allow = overshootAllowed(coil);
  let bumped: number[];
  if (subset.length === 1) {
    const lengthMm = allow
      ? minLengthForPattern(subset[0], nTarget)
      : maxLengthForPattern(subset[0], nTarget);
    if (!Number.isFinite(lengthMm) || (!allow && lengthMm <= 0)) return null;
    bumped = [lengthMm];
  } else {
    const R = subset.map((p) => piecesPerMm(p, nTarget.length));
    const continuous = minSumWithCoverage(R, nTarget);
    if (!continuous) return null;
    bumped = bumpLengthsToIntegerPieces(subset, continuous, nTarget);
    if (!allow) bumped = capLengthsToMax(subset, bumped, nTarget);
  }
  const programs = toPrograms(
    subset.map((pattern, j) => ({ pattern, lengthMm: bumped[j] })),
    nTarget.length,
  );
  return planFromPrograms(planLabel(programs, blanks), programs, blanks, coil, nTarget);
}

function rankPlans(plans: RankedPlan[]): RankedPlan[] {
  const uniq = new Map<string, RankedPlan>();
  for (const plan of plans) {
    const key = plan.programs
      .map(
        (p) =>
          `${patternKey(p.pattern.strips)}@${p.coilLengthMm.toFixed(2)}:${p.piecesPerProduct.join(",")}`,
      )
      .sort()
      .join("||");
    const existing = uniq.get(key);
    if (!existing || plan.yieldPercent > existing.yieldPercent) uniq.set(key, plan);
  }

  return [...uniq.values()].sort((a, b) => {
    if (Math.abs(a.shortfallKg - b.shortfallKg) > 0.5) return a.shortfallKg - b.shortfallKg;
    if (Math.abs(b.yieldPercent - a.yieldPercent) > 0.05) return b.yieldPercent - a.yieldPercent;
    if (a.setupCount !== b.setupCount) return a.setupCount - b.setupCount;
    if (Math.abs(a.overshootKg - b.overshootKg) > 0.5) return a.overshootKg - b.overshootKg;
    return a.coilWeightKg - b.coilWeightKg;
  });
}

function validateInput(input: CalcInput): string | null {
  const { coil, blanks } = input;
  if (!(coil.width > 0)) return "Informe a largura original da bobina.";
  if (!(coil.thickness > 0)) return "Informe a espessura da chapa.";
  if (!(coil.density > 0)) return "Informe a densidade do aço.";
  if (coil.kerf < 0 || coil.edgeTrim < 0) return "Perda de corte e refile não podem ser negativos.";
  const usable = usableWidth(coil);
  if (usable <= 0) return "O refile de borda deixa a largura útil zerada.";
  const active = blanks.filter((b) => b.minKg > 0 || b.minQty > 0);
  if (active.length === 0) return "Informe peso mínimo (kg) ou quantidade para pelo menos um blank.";
  for (const blank of blanks) {
    if (!(blank.width > 0) || !(blank.length > 0)) {
      return "Cada blank precisa de largura e comprimento maiores que zero.";
    }
    const minDim = Math.min(blank.width, blank.length);
    if (minDim > usable + 1e-9) {
      return `O blank ${blank.width}×${blank.length} mm não cabe na largura útil de ${usable} mm.`;
    }
  }
  return null;
}

export function optimizeCutting(input: CalcInput): CalcResult | CalcError {
  const error = validateInput(input);
  if (error) return { ok: false, message: error };

  const blanks = input.blanks.filter((b) => b.width > 0 && b.length > 0);
  const coil = input.coil;
  const allow = overshootAllowed(coil);
  const units = blanks.map((b) => unitWeightKg(b.width, b.length, coil));
  const nTarget = blanks.map((b, i) => targetPiecesForBlank(b, units[i], allow));

  const activeIdx = nTarget.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  if (activeIdx.length === 0) {
    return { ok: false, message: "Informe peso (kg) ou quantidade para pelo menos um blank." };
  }

  const types = blanks.flatMap((blank, i) =>
    nTarget[i] > 0 ? stripTypesForBlank(blank, i).filter((s) => s.stripWidth <= usableWidth(coil) + 1e-9) : [],
  );
  if (types.length === 0) {
    return { ok: false, message: "Nenhuma orientação de blank cabe na largura da bobina." };
  }

  const usable = usableWidth(coil);
  const minStrip = Math.min(...types.map((t) => t.stripWidth));
  const maxStrips = Math.min(6, Math.max(1, Math.floor((usable + coil.kerf) / (minStrip + coil.kerf))));
  const allPatterns = generatePatterns(types, usable, coil.kerf, maxStrips);
  if (allPatterns.length === 0) {
    return { ok: false, message: "Não foi possível montar um plano de corte com essas medidas." };
  }

  const candidates = filterPatterns(allPatterns, nTarget);
  const plans: RankedPlan[] = [];

  const activeCount = nTarget.filter((v) => v > 0).length;
  const maxK = Math.min(activeCount, candidates.length, 5);
  for (let k = 1; k <= maxK; k++) {
    const combos = combinations(candidates, k);
    const limit = k === 1 ? combos.length : k === 2 ? 400 : k === 3 ? 200 : 100;
    const slice = combos.slice(0, limit);
    for (const subset of slice) {
      const plan = evaluateSubset(subset, nTarget, blanks, coil);
      if (plan) plans.push(plan);
    }
  }

  const dedicated: Pattern[] = [];
  for (let i = 0; i < blanks.length; i++) {
    if (nTarget[i] <= 0) continue;
    const onlyThis = allPatterns.filter((p) => p.strips.every((s) => s.productIndex === i));
    const best = onlyThis.sort((a, b) => a.waste - b.waste)[0];
    if (best) dedicated.push(best);
  }
  if (dedicated.length >= 2) {
    const plan = evaluateSubset(dedicated, nTarget, blanks, coil);
    if (plan) plans.push(plan);
  }

  const sequential = buildSequentialPlan(candidates, nTarget, blanks, coil);
  if (sequential) plans.push(sequential);

  const ranked = rankPlans(plans);
  if (ranked.length === 0) {
    return {
      ok: false,
      message: allow
        ? "Não foi possível atender o peso/quantidade mínimos com a largura da bobina."
        : "Não foi possível montar um plano sem ultrapassar o peso informado.",
    };
  }

  const best = ranked[0];
  return {
    ok: true,
    coilWeightKg: best.coilWeightKg,
    usefulWeightKg: best.usefulWeightKg,
    scrapKg: best.scrapKg,
    yieldPercent: best.yieldPercent,
    totalCoilLengthMm: best.totalCoilLengthMm,
    programs: best.programs,
    products: best.products,
    alternatives: ranked.slice(0, 6),
  };
}

export { patternKey };
