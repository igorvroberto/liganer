import type { BlankInput, CoilInput } from "./types";
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
