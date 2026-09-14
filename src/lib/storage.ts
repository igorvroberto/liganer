import {
  budgetDisplayName,
  newBudgetId,
  type AppConfig,
  type BudgetListItem,
  type BudgetRecord,
  type BudgetSource,
} from "./budgetTypes";
import { EMPTY_QUOTE_CLIENT, type QuoteClientInfo } from "./quoteClient";
import {
  EMPTY_QUOTE_CONDITIONS,
  type QuoteConditions,
  type QuoteSummary,
} from "./quoteSummary";
import type { BlankInput } from "./types";

/** Chave própria — não reutilizar a do chapas-bobinas. */
const STORAGE_KEY = "liganer-blanks-slitters-draft-v1";
/** Rascunho antigo (só cliente/condições no botão Salvar). */
const LEGACY_STORAGE_KEY = "liganer-blanks-slitters-quote-v1";
const BUDGETS_KEY = "liganer-blanks-slitters-budgets-v1";

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

function emptySummary(): QuoteSummary {
  return { totalKg: 0, subtotal: 0, ipi: 0, total: 0, frete: 0 };
}

function normalizeBudget(raw: Partial<BudgetRecord> | null | undefined): BudgetRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const items = Array.isArray(raw.items) ? raw.items.filter(isBlankInput) : [];
  const number = String(raw.number ?? raw.name ?? "").trim();
  if (!number) return null;
  const now = new Date().toISOString();
  const demandModes =
    raw.demandModes && typeof raw.demandModes === "object" ? raw.demandModes : {};
  const source: BudgetSource = raw.source === "remote" ? "remote" : "local";
  return {
    id: String(raw.id ?? newBudgetId()),
    number,
    name: budgetDisplayName({ number, name: raw.name }),
    client: { ...EMPTY_QUOTE_CLIENT, ...(raw.client ?? {}) },
    items,
    conditions: { ...EMPTY_QUOTE_CONDITIONS, ...(raw.conditions ?? {}) },
    demandModes,
    allowOvershoot: raw.allowOvershoot !== false,
    summary: { ...emptySummary(), ...(raw.summary ?? {}) },
    createdAt: String(raw.createdAt ?? now),
    savedAt: String(raw.savedAt ?? now),
    source,
  };
}

export function loadSavedBudgets(): BudgetRecord[] {
  try {
    const raw = getItem(BUDGETS_KEY, "[]");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeBudget(row as Partial<BudgetRecord>))
      .filter((row): row is BudgetRecord => row != null)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

function writeSavedBudgets(budgets: BudgetRecord[]): void {
  setItem(BUDGETS_KEY, JSON.stringify(budgets));
}

export function findSavedBudget(number: string): BudgetRecord | null {
  const needle = String(number ?? "").trim();
  if (!needle) return null;
  return loadSavedBudgets().find((b) => b.number === needle) ?? null;
}

export function pushSavedBudget(budget: BudgetRecord): BudgetRecord {
  const normalized = normalizeBudget(budget);
  if (!normalized) throw new Error("Orçamento inválido.");
  const next = [normalized, ...loadSavedBudgets().filter((b) => b.number !== normalized.number)];
  writeSavedBudgets(next);
  return normalized;
}

export function upsertSavedBudget(budget: BudgetRecord): BudgetRecord {
  const normalized = normalizeBudget({
    ...budget,
    savedAt: budget.savedAt || new Date().toISOString(),
    name: budgetDisplayName(budget),
  });
  if (!normalized) throw new Error("Orçamento inválido.");
  const existing = loadSavedBudgets();
  const idx = existing.findIndex((b) => b.number === normalized.number);
  if (idx >= 0) {
    const merged = {
      ...existing[idx],
      ...normalized,
      id: existing[idx].id || normalized.id,
      createdAt: existing[idx].createdAt || normalized.createdAt,
    };
    const copy = [...existing];
    copy[idx] = merged;
    writeSavedBudgets(copy);
    return merged;
  }
  return pushSavedBudget(normalized);
}

export function removeSavedBudget(number: string): void {
  const needle = String(number ?? "").trim();
  if (!needle) return;
  writeSavedBudgets(loadSavedBudgets().filter((b) => b.number !== needle));
}

export function savedBudgetsAsListItems(budgets: BudgetRecord[] = loadSavedBudgets()): BudgetListItem[] {
  return budgets.map((b) => ({
    id: b.id,
    number: b.number,
    name: budgetDisplayName(b),
    client: b.client.name ?? "",
    cnpj: b.client.cnpj ?? "",
    createdAt: b.createdAt,
    savedAt: b.savedAt,
    source: b.source,
  }));
}

export function mergeBudgetLists(
  local: BudgetListItem[],
  remote: BudgetListItem[],
): BudgetListItem[] {
  const map = new Map<string, BudgetListItem>();
  for (const item of local) {
    if (!item.number) continue;
    map.set(item.number, item);
  }
  for (const item of remote) {
    if (!item.number) continue;
    map.set(item.number, { ...item, source: "remote" });
  }
  return [...map.values()].sort((a, b) =>
    String(b.savedAt || b.createdAt).localeCompare(String(a.savedAt || a.createdAt)),
  );
}

export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const url = `${import.meta.env.BASE_URL}config.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return {};
    const json = (await res.json()) as AppConfig;
    return {
      saveUrl: typeof json.saveUrl === "string" ? json.saveUrl.trim() : "",
      syncSecret: typeof json.syncSecret === "string" ? json.syncSecret.trim() : "",
    };
  } catch {
    return {};
  }
}

export function hasRemoteSync(config: AppConfig): boolean {
  return Boolean(config.saveUrl?.trim() && config.syncSecret?.trim());
}

function resolveSaveUrl(config: AppConfig): string {
  const raw = config.saveUrl?.trim() ?? "";
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = import.meta.env.BASE_URL || "/";
  if (raw.startsWith("/")) return raw;
  return `${base}${raw.replace(/^\.\//, "")}`;
}

async function remoteFetch(
  config: AppConfig,
  init: RequestInit & { query?: string } = {},
): Promise<Response> {
  const url = resolveSaveUrl(config) + (init.query ?? "");
  const headers = new Headers(init.headers);
  headers.set("X-Sync-Secret", config.syncSecret ?? "");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}

export async function saveBudgetRemote(
  budget: BudgetRecord,
  config: AppConfig,
): Promise<{ ok: true; number: string; name: string }> {
  const res = await remoteFetch(config, {
    method: "POST",
    body: JSON.stringify(budget),
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    number?: string;
    name?: string;
    error?: string;
  } | null;
  if (!res.ok || !json?.ok || !json.number) {
    throw new Error(json?.error || "Falha ao salvar orçamento no servidor.");
  }
  return { ok: true, number: json.number, name: json.name || json.number };
}

export async function listBudgetsRemote(config: AppConfig): Promise<BudgetListItem[]> {
  const res = await remoteFetch(config, { method: "GET" });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    items?: Array<Partial<BudgetListItem>>;
    error?: string;
  } | null;
  if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
    throw new Error(json?.error || "Falha ao listar orçamentos no servidor.");
  }
  return json.items
    .map((row): BudgetListItem | null => {
      const number = String(row.number ?? row.name ?? "").trim();
      if (!number) return null;
      return {
        id: String(row.id ?? number),
        number,
        name: budgetDisplayName({ number, name: row.name }),
        client: String(row.client ?? ""),
        cnpj: String(row.cnpj ?? ""),
        createdAt: String(row.createdAt ?? ""),
        savedAt: String(row.savedAt ?? row.createdAt ?? ""),
        source: "remote",
      };
    })
    .filter((row): row is BudgetListItem => row != null);
}

export async function fetchBudgetRemote(
  number: string,
  config: AppConfig,
): Promise<BudgetRecord> {
  const res = await remoteFetch(config, {
    method: "GET",
    query: `?number=${encodeURIComponent(number)}`,
  });
  const json = (await res.json().catch(() => null)) as
    | (Partial<BudgetRecord> & { ok?: boolean; error?: string })
    | null;
  if (!res.ok || !json || json.ok === false) {
    throw new Error(json?.error || "Falha ao carregar orçamento do servidor.");
  }
  const budget = normalizeBudget({ ...json, source: "remote" });
  if (!budget) throw new Error("Orçamento remoto inválido.");
  return budget;
}

export async function deleteBudgetRemote(number: string, config: AppConfig): Promise<void> {
  const res = await remoteFetch(config, {
    method: "DELETE",
    query: `?number=${encodeURIComponent(number)}`,
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
  } | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Falha ao excluir orçamento no servidor.");
  }
}

export type { AppConfig, BudgetListItem, BudgetRecord };
export { budgetDisplayName, newBudgetId } from "./budgetTypes";
