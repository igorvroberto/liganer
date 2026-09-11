const numberFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const kgFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pctFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function fmtKg(value: number): string {
  return `${kgFmt.format(value)} Kg`;
}

export function fmtMm(value: number): string {
  return `${numberFmt.format(value)} mm`;
}

export function fmtMeters(mm: number): string {
  return `${numberFmt.format(mm / 1000)} m`;
}

export function fmtInt(value: number): string {
  return intFmt.format(value);
}

/** Inteiro sem separador de milhar (dimensões em mm nos PDFs). */
export function fmtPlainInt(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    useGrouping: false,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Número sem separador de milhar (vírgula decimal pt-BR). */
export function fmtPlainNumber(value: number, maxDigits = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  }).format(value);
}

/** Dimensão em mm sem separador de milhar. */
export function fmtPlainMm(value: number): string {
  return `${fmtPlainNumber(value)} mm`;
}

export function fmtPct(value: number): string {
  return `${pctFmt.format(value)}%`;
}

export function fmtDim(width: number, length: number): string {
  return `${fmtInt(width)} × ${fmtInt(length)} mm`;
}

const thicknessFmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtThickness(value: number): string {
  return thicknessFmt.format(value);
}

const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const currency2Fmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtCurrency(value: number, decimals: 2 | 4 = 2): string {
  return decimals === 4 ? currencyFmt.format(value) : currency2Fmt.format(value);
}

export function parseDecimalBr(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Arredonda para 2 casas (preço fator 100 e similares). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Texto pt-BR com exatamente 2 casas após a vírgula. */
export function fmtDecimal2(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/** Aceita só até 2 casas após vírgula/ponto; retorna arredondado ou null. */
export function parseDecimalBr2(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d*([.,]\d{0,2})?$/.test(trimmed)) return null;
  const n = parseDecimalBr(trimmed);
  return n == null ? null : round2(n);
}

export function parseThickness(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}
