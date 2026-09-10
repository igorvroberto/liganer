import * as XLSX from "xlsx";
import fallback from "./priceTableFallback.json";
import type { PvcOption } from "./types";

export type PriceKey =
  | "bobina_inteira"
  | "bobina_reduzida_ou_chapa_sem_pvc"
  | "azul"
  | "preto_e_branco"
  | "preto"
  | "nitto_fiber";

export type PriceRow = {
  tipo: string;
  espessura: number;
  acabamento: string;
  icms: number;
  precos: Record<PriceKey, number>;
};

export type PriceTableState = {
  rows: PriceRow[];
  source: string;
  pvcColumns: PriceKey[];
};

export type PriceTableOptions = {
  tipo: string[];
  acabamento: string[];
  pvc: { value: PvcOption; label: string }[];
  espessura: number[];
};

export type PriceLookupInput = {
  tipo?: string;
  acabamento?: string;
  espessura?: number;
  pvc?: PvcOption;
};

export type PriceLookupResult = {
  precoFator100: number;
  icms: number;
  matched: boolean;
  column: PriceKey | null;
};

const ALL_PRICE_KEYS: PriceKey[] = [
  "bobina_inteira",
  "bobina_reduzida_ou_chapa_sem_pvc",
  "azul",
  "preto_e_branco",
  "preto",
  "nitto_fiber",
];

const PVC_PRICE_KEYS: PriceKey[] = ["azul", "preto_e_branco", "preto", "nitto_fiber"];

const HEADER_ALIASES: Record<PriceKey, string[]> = {
  bobina_inteira: ["bobina inteira"],
  bobina_reduzida_ou_chapa_sem_pvc: [
    "bobina reduzida ou chapa sem pvc",
    "bobina reduzida",
    "chapa sem pvc",
  ],
  azul: ["azul"],
  preto_e_branco: ["preto e branco"],
  preto: ["preto"],
  nitto_fiber: ["nitto fiber", "fiber"],
};

const PVC_LABELS: Record<Exclude<PvcOption, "sem">, string> = {
  azul: "Azul",
  "preto-branco": "Preto e branco",
  preto: "Preto",
  nitto: "Nitto Fiber",
};

const PVC_VALUE_BY_KEY: Record<Exclude<PriceKey, "bobina_inteira" | "bobina_reduzida_ou_chapa_sem_pvc">, PvcOption> =
  {
    azul: "azul",
    preto_e_branco: "preto-branco",
    preto: "preto",
    nitto_fiber: "nitto",
  };

/** URLs de carga: tabela compartilhada no orçamento, depois cópia local do app. */
export const PRICE_TABLE_URLS = [
  "/orcamento/tabelas/precos-chapas-bobinas.xlsx",
  `${import.meta.env.BASE_URL}tabelas/precos-chapas-bobinas.xlsx`,
];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null || value === "") return 0;
  const text = String(value).trim();
  if (!text) return 0;
  const n = text.includes(",")
    ? Number(text.replace(/\./g, "").replace(",", "."))
    : Number(text.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function normalizeTipo(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/** N4 da planilha vira ESCOVADO (mesma regra do orçamento chapas/bobinas). */
export function normalizeAcabamento(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return text === "ESCOVADO" || text === "N4" ? "ESCOVADO" : text;
}

export function normalizeEspessura(value: unknown): number {
  return Math.round(parseNumber(value) * 1000) / 1000;
}

function roundPrice(value: number): number {
  return value ? Math.round(value * 1e6) / 1e6 : 0;
}

function findColumn(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const exact = headers.findIndex((h) => h === alias);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const partial = headers.findIndex((h) => h.includes(alias));
    if (partial >= 0) return partial;
  }
  return -1;
}

function emptyPrecos(): Record<PriceKey, number> {
  return {
    bobina_inteira: 0,
    bobina_reduzida_ou_chapa_sem_pvc: 0,
    azul: 0,
    preto_e_branco: 0,
    preto: 0,
    nitto_fiber: 0,
  };
}

export function parsePriceWorkbook(data: ArrayBuffer): {
  rows: PriceRow[];
  pvcColumns: PriceKey[];
} {
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], pvcColumns: [...PVC_PRICE_KEYS] };

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (!matrix.length) return { rows: [], pvcColumns: [...PVC_PRICE_KEYS] };

  const headers = (matrix[0] || []).map(normalizeHeader);
  const tipoCol = findColumn(headers, ["tipo"]);
  const espCol = findColumn(headers, ["espessura"]);
  const acabCol = findColumn(headers, ["acabamento"]);
  const icmsCol = findColumn(headers, ["icms"]);
  if (tipoCol < 0 || espCol < 0 || acabCol < 0) {
    return { rows: [], pvcColumns: [...PVC_PRICE_KEYS] };
  }

  const colMap: Partial<Record<PriceKey, number>> = {};
  for (const key of ALL_PRICE_KEYS) {
    colMap[key] = findColumn(headers, HEADER_ALIASES[key]);
  }
  const pvcColumns = PVC_PRICE_KEYS.filter((key) => (colMap[key] ?? -1) >= 0);

  const rows: PriceRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const tipo = normalizeTipo(row[tipoCol]);
    const acabamento = normalizeAcabamento(row[acabCol]);
    const espessura = normalizeEspessura(row[espCol]);
    if (!tipo || !acabamento || !espessura) continue;

    const precos = emptyPrecos();
    for (const key of ALL_PRICE_KEYS) {
      const col = colMap[key] ?? -1;
      precos[key] = col >= 0 ? roundPrice(parseNumber(row[col])) : 0;
    }

    const icmsRaw = icmsCol >= 0 ? parseNumber(row[icmsCol]) : 0;
    rows.push({
      tipo,
      espessura,
      acabamento,
      icms: icmsRaw ? (icmsRaw > 1 ? icmsRaw / 100 : icmsRaw) : 0,
      precos,
    });
  }

  return { rows, pvcColumns: pvcColumns.length ? pvcColumns : [...PVC_PRICE_KEYS] };
}

function fallbackState(): PriceTableState {
  const data = fallback as {
    source: string;
    rows: PriceRow[];
    pvcColumns: PriceKey[];
  };
  return {
    rows: data.rows,
    source: data.source || "fallback-json",
    pvcColumns: data.pvcColumns?.length ? data.pvcColumns : [...PVC_PRICE_KEYS],
  };
}

let current: PriceTableState = fallbackState();
let index = buildIndex(current.rows);

function buildIndex(rows: PriceRow[]): Map<string, PriceRow> {
  const map = new Map<string, PriceRow>();
  for (const row of rows) {
    map.set(`${row.tipo}|${normalizeEspessura(row.espessura)}|${row.acabamento}`, row);
  }
  return map;
}

function setState(next: PriceTableState) {
  current = next;
  index = buildIndex(next.rows);
}

export function getPriceTableState(): PriceTableState {
  return current;
}

export async function loadPriceTable(urls: string[] = PRICE_TABLE_URLS): Promise<{
  ok: boolean;
  rows: number;
  source: string;
  error?: string;
}> {
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const parsed = parsePriceWorkbook(await response.arrayBuffer());
      if (!parsed.rows.length) continue;
      setState({ rows: parsed.rows, source: url, pvcColumns: parsed.pvcColumns });
      return { ok: true, rows: parsed.rows.length, source: url };
    } catch {
      // tenta a próxima URL
    }
  }

  const fb = fallbackState();
  setState(fb);
  return {
    ok: false,
    rows: fb.rows.length,
    source: fb.source,
    error: "Falha ao carregar planilha; usando tabela embutida",
  };
}

/** Opções globais (ou filtradas por tipo/acabamento). */
export function priceTableOptions(filter?: {
  tipo?: string;
  acabamento?: string;
}): PriceTableOptions {
  const tipoFilter = filter?.tipo ? normalizeTipo(filter.tipo) : "";
  const acabFilter = filter?.acabamento ? normalizeAcabamento(filter.acabamento) : "";

  const tipos: string[] = [];
  const acabamentos: string[] = [];
  const espessuras: number[] = [];
  const tipoSet = new Set<string>();
  const acabSet = new Set<string>();
  const espSet = new Set<number>();

  for (const row of current.rows) {
    if (row.tipo && !tipoSet.has(row.tipo)) {
      tipoSet.add(row.tipo);
      tipos.push(row.tipo);
    }

    if (tipoFilter && row.tipo !== tipoFilter) continue;

    if (row.acabamento && !acabSet.has(row.acabamento)) {
      acabSet.add(row.acabamento);
      acabamentos.push(row.acabamento);
    }

    if (acabFilter && row.acabamento !== acabFilter) continue;

    if (row.espessura && !espSet.has(row.espessura)) {
      espSet.add(row.espessura);
      espessuras.push(row.espessura);
    }
  }

  espessuras.sort((a, b) => a - b);

  const pvc = [
    { value: "sem" as const, label: "Não" },
    ...current.pvcColumns
      .map((key) => {
        const value = PVC_VALUE_BY_KEY[key as keyof typeof PVC_VALUE_BY_KEY];
        if (!value || value === "sem") return null;
        return { value, label: PVC_LABELS[value] };
      })
      .filter((opt): opt is { value: Exclude<PvcOption, "sem">; label: string } => !!opt),
  ];

  return { tipo: tipos, acabamento: acabamentos, pvc, espessura: espessuras };
}

export function priceColumnForPvc(pvc: PvcOption | undefined): PriceKey {
  switch (pvc) {
    case "azul":
      return "azul";
    case "preto-branco":
      return "preto_e_branco";
    case "preto":
      return "preto";
    case "nitto":
      return "nitto_fiber";
    case "sem":
    default:
      // Slitters: sem PVC → bobina reduzida / chapa sem PVC
      return "bobina_reduzida_ou_chapa_sem_pvc";
  }
}

export function findPriceRow(input: PriceLookupInput): PriceRow | null {
  const tipo = normalizeTipo(input.tipo);
  const acabamento = normalizeAcabamento(input.acabamento);
  const espessura = normalizeEspessura(input.espessura);
  if (!tipo || !acabamento || !espessura) return null;
  return index.get(`${tipo}|${espessura}|${acabamento}`) ?? null;
}

export function lookupPriceFator100(input: PriceLookupInput): PriceLookupResult {
  const row = findPriceRow(input);
  const column = priceColumnForPvc(input.pvc);
  if (!row) return { precoFator100: 0, icms: 0, matched: false, column };
  const price = row.precos[column] || 0;
  return {
    precoFator100: price,
    icms: row.icms || 0,
    matched: price > 0,
    column,
  };
}

export function lineLabelFromSpecs(tipo?: string, acabamento?: string): string {
  const t = normalizeTipo(tipo);
  const a = normalizeAcabamento(acabamento);
  if (t && a) return `${t} ${a}`;
  return t || a || "";
}

/** Expõe o parser para testes com buffer local. */
export function applyParsedPriceTable(
  rows: PriceRow[],
  source: string,
  pvcColumns: PriceKey[] = [...PVC_PRICE_KEYS],
) {
  setState({ rows, source, pvcColumns });
}

export function resetPriceTableToFallback() {
  setState(fallbackState());
}
