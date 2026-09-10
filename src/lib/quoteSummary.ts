import type { BlankInput, CoilInput, RankedPlan } from "./types";
import { programLoss } from "./optimize";
import {
  acrescimoPerdaPct,
  applyLossSurcharge,
  type ItemLongitudinalLoss,
} from "./lossSurcharge";

export type { ItemLongitudinalLoss };

/** Mesma alíquota do orçamento chapas-bobinas. */
export const IPI_RATE = 0.0325;

export type ItemCommercial = {
  priceFactor100: number | undefined;
  icms: number | undefined;
  usedPrice: number | null;
  /** Preço base (fator utilizado + serviço), antes do acréscimo de perda. */
  baseTotalPrice: number | null;
  totalPrice: number | null;
  /** Preço sem IPI (R$/Kg). null quando não calculável. */
  priceWithoutIpi: number | null;
  subtotal: number | null;
  pesoTotal: number;
  perdaMm: number | null;
  perdaPct: number | null;
  acrescimoPerda: number | null;
};

export type QuoteSummary = {
  totalKg: number;
  subtotal: number;
  ipi: number;
  total: number;
  frete: number;
};

function calcUsedFactorPrice(
  priceFactor100: number | undefined,
  usedFactor: number | undefined,
): number | null {
  if (!priceFactor100 || !usedFactor || usedFactor <= 0) return null;
  return priceFactor100 / (usedFactor / 100);
}

/** Perda longitudinal por item a partir do plano de corte selecionado. */
export function itemLossFromPlan(
  plan: RankedPlan | null,
  coil: CoilInput,
): Record<string, ItemLongitudinalLoss> {
  if (!plan) return {};
  const map: Record<string, ItemLongitudinalLoss> = {};
  for (const program of plan.programs) {
    const loss = programLoss(program, coil);
    const seen = new Set<number>();
    for (const strip of program.pattern.strips) {
      if (seen.has(strip.productIndex)) continue;
      seen.add(strip.productIndex);
      const blank = plan.products[strip.productIndex]?.blank;
      if (!blank) continue;
      const next: ItemLongitudinalLoss = {
        perdaMm: loss.widthWasteMm,
        perdaPct: loss.lossPercent,
      };
      const prev = map[blank.id];
      if (!prev || next.perdaMm > prev.perdaMm) map[blank.id] = next;
    }
  }
  return map;
}

/**
 * Valores comerciais do item — preço total inclui acréscimo de perda longitudinal
 * quando houver programa de corte.
 */
export function itemCommercial(
  item: BlankInput,
  loss?: ItemLongitudinalLoss | null,
): ItemCommercial {
  const usedPrice = calcUsedFactorPrice(item.priceFactor100, item.usedFactor);
  const service = item.servicePrice ?? 0;
  const baseTotalPrice = usedPrice != null ? usedPrice + service : null;
  const perdaMm = loss && loss.perdaMm >= 0 ? loss.perdaMm : null;
  const perdaPct = loss && loss.perdaPct >= 0 ? loss.perdaPct : null;
  const acrescimoPerda =
    perdaMm != null && perdaPct != null ? acrescimoPerdaPct(perdaMm, perdaPct) : null;
  const totalPrice =
    baseTotalPrice != null && perdaMm != null && perdaPct != null
      ? applyLossSurcharge(baseTotalPrice, perdaMm, perdaPct)
      : baseTotalPrice;
  const priceWithoutIpi = totalPrice;
  const pesoTotal = item.minKg > 0 ? item.minKg : 0;
  const subtotal =
    priceWithoutIpi != null && pesoTotal > 0 ? pesoTotal * priceWithoutIpi : null;
  return {
    priceFactor100: item.priceFactor100,
    icms: item.icms,
    usedPrice,
    baseTotalPrice,
    totalPrice,
    priceWithoutIpi,
    subtotal,
    pesoTotal,
    perdaMm,
    perdaPct,
    acrescimoPerda,
  };
}

/** Totais do orçamento — idêntico ao `xb` de chapas-bobinas. */
export function quoteSummary(
  items: BlankInput[],
  lossByItemId: Record<string, ItemLongitudinalLoss> = {},
): QuoteSummary {
  let totalKg = 0;
  let subtotal = 0;
  for (const item of items) {
    const row = itemCommercial(item, lossByItemId[item.id] ?? null);
    const price = row.priceWithoutIpi ?? 0;
    totalKg += price === 0 ? 0 : row.pesoTotal;
    subtotal += row.subtotal ?? 0;
  }
  const ipi = subtotal * IPI_RATE;
  return {
    totalKg,
    subtotal,
    ipi,
    total: subtotal + ipi,
    frete: 0,
  };
}

export type QuoteConditions = {
  pagamento: string;
  prazo_entrega: string;
  local_expedicao: string;
  cidade_cliente: string;
  tipo_frete: string;
  observacoes_gerais: string;
};

export const EMPTY_QUOTE_CONDITIONS: QuoteConditions = {
  pagamento: "",
  prazo_entrega: "",
  local_expedicao: "",
  cidade_cliente: "",
  tipo_frete: "",
  observacoes_gerais: "",
};

export const LOCAL_EXPEDICAO_OPTIONS = ["SP", "CE"] as const;
export const TIPO_FRETE_OPTIONS = ["CIF", "FOB"] as const;

export const QUOTE_CONDITION_FIELDS: Array<{
  key: keyof QuoteConditions;
  label: string;
  kind: "text" | "select";
  options?: readonly string[];
}> = [
  { key: "pagamento", label: "Pagamento", kind: "text" },
  { key: "prazo_entrega", label: "Prazo de entrega", kind: "text" },
  { key: "local_expedicao", label: "Local de expedição", kind: "select", options: LOCAL_EXPEDICAO_OPTIONS },
  { key: "cidade_cliente", label: "Cidade do cliente", kind: "text" },
  { key: "tipo_frete", label: "Tipo de frete", kind: "select", options: TIPO_FRETE_OPTIONS },
  { key: "observacoes_gerais", label: "Observações gerais", kind: "text" },
];
