import { itemUnitWeightKg, unitWeightKg } from "./optimize";
import type { BlankInput, CoilInput } from "./types";
import { isSlitterItem, itemKindOf } from "./types";

export type BlankDemandMode = "qty" | "weight";

/** Unidade de peso: blank = peça; slitter = peça (com comprimento) ou 1 mm (sem comprimento). */
export function blankUnitKg(
  blank: Pick<BlankInput, "width" | "length" | "itemKind">,
  coil: CoilInput,
): number {
  return itemUnitWeightKg(blank as BlankInput, coil);
}

export function syncBlankFromQty(
  qty: number,
  unitKg: number,
): Pick<BlankInput, "minQty" | "minKg"> {
  const minQty = Math.max(0, Math.floor(qty));
  return {
    minQty,
    minKg: unitKg > 0 ? minQty * unitKg : 0,
  };
}

export function syncBlankFromWeight(
  kg: number,
  unitKg: number,
): Pick<BlankInput, "minQty" | "minKg"> {
  const minKg = Math.max(0, kg);
  if (unitKg <= 0) return { minKg, minQty: 0 };
  const minQty = Math.ceil(minKg / unitKg - 1e-9);
  return { minKg, minQty };
}

export function resyncBlankDemand(
  blank: BlankInput,
  coil: CoilInput,
  mode: BlankDemandMode,
): BlankInput {
  // Slitter: Qtd é só manual; comprimento ↔ peso (não usa este resync).
  if (isSlitterItem(blank)) return blank;
  const unitKg = blankUnitKg(blank, coil);
  if (unitKg <= 0) return blank;
  if (mode === "qty") {
    return { ...blank, ...syncBlankFromQty(blank.minQty, unitKg) };
  }
  return { ...blank, ...syncBlankFromWeight(blank.minKg, unitKg) };
}

/** Kg por mm de tira (largura × espessura). */
export function slitterKgPerMm(
  width: number,
  coil: Pick<CoilInput, "thickness" | "density">,
): number {
  if (!(width > 0) || !(coil.thickness > 0) || !(coil.density > 0)) return 0;
  return unitWeightKg(width, 1, coil as CoilInput);
}

/**
 * Comprimento (mm) a partir do peso e da Qtd (manual).
 * Sem Qtd, assume 1 peça/tira.
 */
export function slitterLengthFromWeight(
  blank: Pick<BlankInput, "width" | "minKg" | "minQty">,
  coil: CoilInput,
): number {
  const perMm = slitterKgPerMm(blank.width, coil);
  if (perMm <= 0 || !(blank.minKg > 0)) return 0;
  const qty = blank.minQty > 0 ? blank.minQty : 1;
  return Math.max(0, Math.round(blank.minKg / (qty * perMm)));
}

/** Peso total a partir do comprimento e da Qtd (manual). */
export function slitterWeightFromLength(
  blank: Pick<BlankInput, "width" | "length" | "minQty">,
  coil: CoilInput,
): number {
  if (!(blank.width > 0) || !(blank.length > 0)) return 0;
  const unit = unitWeightKg(blank.width, blank.length, coil);
  const qty = blank.minQty > 0 ? blank.minQty : 1;
  return qty * unit;
}

/** Após mudar peso no SLITTER: recalcula comprimento; não mexe na Qtd. */
export function syncSlitterFromWeight(blank: BlankInput, coil: CoilInput): BlankInput {
  const length = slitterLengthFromWeight(blank, coil);
  return { ...blank, length };
}

/** Após mudar comprimento no SLITTER (só se já houver peso): recalcula peso; não mexe na Qtd. */
export function syncSlitterFromLength(blank: BlankInput, coil: CoilInput): BlankInput {
  if (!(blank.minKg > 0)) return blank;
  const minKg = slitterWeightFromLength(blank, coil);
  return { ...blank, minKg };
}

/**
 * Após mudar Qtd no SLITTER (manual):
 * - com comprimento → recalcula peso
 * - sem comprimento, com peso → recalcula comprimento
 */
export function syncSlitterFromQty(blank: BlankInput, coil: CoilInput): BlankInput {
  if (blank.length > 0) {
    return { ...blank, minKg: slitterWeightFromLength(blank, coil) };
  }
  if (blank.minKg > 0) {
    return { ...blank, length: slitterLengthFromWeight(blank, coil) };
  }
  return blank;
}

export function defaultBlankFromWeight(
  partial: Partial<BlankInput>,
  coil: CoilInput,
  targetKg = 1000,
): BlankInput {
  const base: BlankInput = {
    id: partial.id ?? `blank-${Date.now()}`,
    name: partial.name ?? "",
    width: partial.width ?? 0,
    length: partial.length ?? 0,
    minKg: 0,
    minQty: 0,
    ...partial,
  };
  if (itemKindOf(base) === "slitter") {
    return syncSlitterFromWeight({ ...base, minKg: targetKg }, coil);
  }
  const unitKg = blankUnitKg(base, coil);
  if (unitKg <= 0) return { ...base, minKg: targetKg, minQty: 0 };
  return { ...base, ...syncBlankFromWeight(targetKg, unitKg) };
}
