import { EMPTY_QUOTE_CLIENT, type QuoteClientInfo } from "./quoteClient";
import { EMPTY_QUOTE_CONDITIONS, type QuoteConditions } from "./quoteSummary";
import type { BlankInput } from "./types";

/** Chave própria — não reutilizar a do chapas-bobinas. */
const STORAGE_KEY = "liganer-blanks-slitters-draft-v1";
/** Rascunho antigo (só cliente/condições no botão Salvar). */
const LEGACY_STORAGE_KEY = "liganer-blanks-slitters-quote-v1";

const memory: Record<string, string> = {};

function getItem(key: string, fallback = ""): string {
  try {
    return window.localStorage?.getItem(key) ?? fallback;
  } catch {
    return memory[key] ?? fallback;
  }
}

function setItem(key: string, value: string): void {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    memory[key] = value;
  }
}

export type DraftState = {
  client: QuoteClientInfo;
  items: BlankInput[];
  conditions: QuoteConditions;
  demandModes: Record<string, "qty" | "weight">;
  allowOvershoot: boolean;
};

type LegacyDraft = {
  conditions?: QuoteConditions;
  client?: QuoteClientInfo;
};

function isBlankInput(value: unknown): value is BlankInput {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.width === "number";
}

function normalizeDraft(raw: Partial<DraftState> | null | undefined): DraftState | null {
  if (!raw) return null;
  const items = Array.isArray(raw.items) ? raw.items.filter(isBlankInput) : [];
  const demandModes =
    raw.demandModes && typeof raw.demandModes === "object" ? raw.demandModes : {};
  return {
    client: { ...EMPTY_QUOTE_CLIENT, ...(raw.client ?? {}) },
    items,
    conditions: { ...EMPTY_QUOTE_CONDITIONS, ...(raw.conditions ?? {}) },
    demandModes,
    allowOvershoot: raw.allowOvershoot !== false,
  };
}

function loadLegacyPartial(): Partial<DraftState> | null {
  try {
    const raw = getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacyDraft;
    return {
      client: parsed.client ? { ...EMPTY_QUOTE_CLIENT, ...parsed.client } : undefined,
      conditions: parsed.conditions
        ? { ...EMPTY_QUOTE_CONDITIONS, ...parsed.conditions }
        : undefined,
    };
  } catch {
    return null;
  }
}

export function loadDraft(): DraftState | null {
  try {
    const raw = getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DraftState>;
      return normalizeDraft(parsed);
    }
    const legacy = loadLegacyPartial();
    return legacy ? normalizeDraft({ ...legacy, items: [], demandModes: {} }) : null;
  } catch {
    return null;
  }
}

export function saveDraft(state: DraftState): void {
  setItem(
    STORAGE_KEY,
    JSON.stringify({
      client: state.client,
      items: state.items,
      conditions: state.conditions,
      demandModes: state.demandModes,
      allowOvershoot: state.allowOvershoot,
    } satisfies DraftState),
  );
}

/**
 * Número do orçamento no padrão chapas: AAMMDD + seq do dia (2 dígitos).
 * Ex.: 1º de 10/09/2026 → 26091001; 2º → 26091002; 99º → 26091099.
 */
export function localPrintNumber(now = new Date()): string {
  const ymd = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const key = `liganer-blanks-slitters-print-${ymd}`;
  const next = Number(getItem(key, "0")) + 1;
  setItem(key, String(next));
  return `${ymd}${String(next).padStart(2, "0")}`;
}
