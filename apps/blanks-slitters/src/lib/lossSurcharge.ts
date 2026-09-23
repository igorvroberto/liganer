/** Perda longitudinal do programa de corte (sobra de largura). */
export type ItemLongitudinalLoss = {
  perdaMm: number;
  /** Perda longitudinal em % (0–100). */
  perdaPct: number;
};

/**
 * Acréscimo de perda (%) a aplicar no preço total:
 * - perda mm < 100 → perda %
 * - perda mm < 300 → perda % × 0,30
 * - perda mm ≥ 300 → perda % × 0,20
 */
export function acrescimoPerdaPct(perdaMm: number, perdaPct: number): number {
  if (!(perdaMm >= 0) || !(perdaPct > 0)) return 0;
  if (perdaMm < 100) return perdaPct;
  if (perdaMm < 300) return perdaPct * 0.3;
  return perdaPct * 0.2;
}

export function applyLossSurcharge(basePrice: number, perdaMm: number, perdaPct: number): number {
  const acrescimo = acrescimoPerdaPct(perdaMm, perdaPct);
  return basePrice * (1 + acrescimo / 100);
}
