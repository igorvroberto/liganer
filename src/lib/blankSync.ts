import type { BlankInput, CoilInput } from "./types";
import { itemUnitWeightKg } from "./optimize";

export type BlankDemandMode = "qty" | "weight";

/** Unidade de peso: blank = peça; slitter = 1 mm de tira (sem comprimento fixo). */
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
  const unitKg = blankUnitKg(blank, coil);
  if (unitKg <= 0) return blank;
  if (mode === "qty") {
    return { ...blank, ...syncBlankFromQty(blank.minQty, unitKg) };
  }
  return { ...blank, ...syncBlankFromWeight(blank.minKg, unitKg) };
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
  const unitKg = blankUnitKg(base, coil);
  if (unitKg <= 0) return { ...base, minKg: targetKg, minQty: 0 };
  return { ...base, ...syncBlankFromWeight(targetKg, unitKg) };
}
