const numberFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const kgFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pctFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export function fmtNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function fmtKg(value: number): string {
  return `${kgFmt.format(value)} kg`;
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

export function parseThickness(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}
