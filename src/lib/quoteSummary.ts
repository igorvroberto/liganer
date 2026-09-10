import type { BlankInput } from "./types";

/** Mesma alíquota do orçamento chapas-bobinas. */
export const IPI_RATE = 0.0325;

export type ItemCommercial = {
  priceFactor100: number | undefined;
  icms: number | undefined;
  usedPrice: number | null;
  totalPrice: number | null;
  /** Preço sem IPI (R$/Kg). null quando não calculável. */
  priceWithoutIpi: number | null;
  subtotal: number | null;
  pesoTotal: number;
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

/**
 * Valores comerciais do item — mesma lógica base do chapas-bobinas
 * (frete % ainda não entra no preço sem IPI).
 */
export function itemCommercial(item: BlankInput): ItemCommercial {
  const usedPrice = calcUsedFactorPrice(item.priceFactor100, item.usedFactor);
  const service = item.servicePrice ?? 0;
  const totalPrice = usedPrice != null ? usedPrice + service : null;
  const priceWithoutIpi = totalPrice;
  const pesoTotal = item.minKg > 0 ? item.minKg : 0;
  const subtotal =
    priceWithoutIpi != null && pesoTotal > 0 ? pesoTotal * priceWithoutIpi : null;
  return {
    priceFactor100: item.priceFactor100,
    icms: item.icms,
    usedPrice,
    totalPrice,
    priceWithoutIpi,
    subtotal,
    pesoTotal,
  };
}

/** Totais do orçamento — idêntico ao `xb` de chapas-bobinas. */
export function quoteSummary(items: BlankInput[]): QuoteSummary {
  let totalKg = 0;
  let subtotal = 0;
  for (const item of items) {
    const row = itemCommercial(item);
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
