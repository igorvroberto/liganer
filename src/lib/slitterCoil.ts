import { productIndicesInProgram } from "./optimize";
import type { BlankInput, CoilInput, ProgramResult } from "./types";
import { DEFAULT_DENSITY, FIXED_EDGE_TRIM_MM } from "./types";

/** Monta a bobina do plano a partir dos itens (primeiro com largura/espessura preenchidas). */
export function coilFromSlitterItems(
  items: BlankInput[],
  allowOvershoot: boolean,
): CoilInput {
  const source =
    items.find((item) => (item.coilWidth ?? 0) > 0 && (item.thickness ?? 0) > 0) ??
    items.find((item) => (item.coilWidth ?? 0) > 0 || (item.thickness ?? 0) > 0) ??
    items[0];

  return {
    width: source?.coilWidth ?? 0,
    thickness: source?.thickness ?? 0,
    density: DEFAULT_DENSITY,
    kerf: 0,
    edgeTrim: FIXED_EDGE_TRIM_MM,
    allowOvershoot,
    line: source?.line,
    pvc: source?.pvc,
    priceFactor100: source?.priceFactor100,
    usedFactor: source?.usedFactor,
    servicePrice: source?.servicePrice,
    serviceDescription: source?.serviceDescription,
  };
}

/**
 * Bobina efetiva de um programa: espessura/largura dos itens daquele programa,
 * não do primeiro item global (necessário quando há vários materiais no plano).
 */
export function coilForProgram(
  program: ProgramResult,
  products: { blank: BlankInput }[],
  baseCoil: CoilInput,
): CoilInput {
  const indices = productIndicesInProgram(program);
  const blanks = indices
    .map((i) => products[i]?.blank)
    .filter((b): b is BlankInput => Boolean(b));
  const source =
    blanks.find((b) => (b.coilWidth ?? 0) > 0 && (b.thickness ?? 0) > 0) ??
    blanks.find((b) => (b.coilWidth ?? 0) > 0 || (b.thickness ?? 0) > 0) ??
    blanks[0];
  if (!source) return baseCoil;

  return {
    ...baseCoil,
    width: source.coilWidth && source.coilWidth > 0 ? source.coilWidth : baseCoil.width,
    thickness: source.thickness && source.thickness > 0 ? source.thickness : baseCoil.thickness,
    pvc: source.pvc ?? baseCoil.pvc,
    line: source.line ?? baseCoil.line,
    priceFactor100: source.priceFactor100 ?? baseCoil.priceFactor100,
    usedFactor: source.usedFactor ?? baseCoil.usedFactor,
    servicePrice: source.servicePrice ?? baseCoil.servicePrice,
    serviceDescription: source.serviceDescription ?? baseCoil.serviceDescription,
  };
}
