import {
  budgetDisplayName,
  compareBudgetListItemsDefault,
  listTotalsFromSummary,
  newBudgetId,
  normalizeBudgetSituacao,
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
import { normalizeVendasUser } from "./vendasAuth";
import {
  deleteBudgetRemote as deleteBudgetRemoteShared,
  fetchBudgetRemote as fetchBudgetRemoteShared,
  listBudgetsRemote as listBudgetsRemoteShared,
  loadSyncConfig,
  remoteListClientFields,
  saveBudgetRemote as saveBudgetRemoteShared,
  type SyncConfig,
} from "@liganer/shared";

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
    owner: normalizeVendasUser(raw.owner),
    situacao: normalizeBudgetSituacao(raw.situacao),
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
      owner: normalized.owner ?? existing[idx].owner ?? null,
    };
    const copy = [...existing];
    copy[idx] = merged;
    writeSavedBudgets(copy);
    return merged;
  }
  return pushSavedBudget(normalized);
}

export function removeSavedBudget(idOrNumber: string): void {
  const key = String(idOrNumber ?? "").trim();
  if (!key) return;
  writeSavedBudgets(
    loadSavedBudgets().filter((b) => b.id !== key && b.number !== key && b.name !== key),
  );
}

export function savedBudgetsAsListItems(budgets: BudgetRecord[] = loadSavedBudgets()): BudgetListItem[] {
  return budgets
    .map((b) => {
      const totals = listTotalsFromSummary(b.summary);
      return {
        id: b.id,
        number: b.number,
        name: budgetDisplayName(b),
        client: b.client.name ?? "",
        cnpj: b.client.cnpj ?? "",
        createdAt: b.createdAt,
        savedAt: b.savedAt,
        source: b.source,
        owner: b.owner ?? null,
        totalKg: totals.totalKg,
        totalRs: totals.totalRs,
        situacao: normalizeBudgetSituacao(b.situacao),
      };
    })
    .sort(compareBudgetListItemsDefault);
}

export function mergeBudgetLists(
  local: BudgetListItem[],
  remote: BudgetListItem[],
): BudgetListItem[] {
  const map = new Map<string, BudgetListItem>();
  for (const item of local) {
    if (!item.number) continue;
    map.set(item.number, {
      ...item,
      situacao: normalizeBudgetSituacao(item.situacao),
    });
  }
  for (const item of remote) {
    if (!item.number) continue;
    const previous = map.get(item.number);
    map.set(item.number, {
      ...previous,
      ...item,
      source: "remote",
      situacao: normalizeBudgetSituacao(item.situacao ?? previous?.situacao),
      totalKg:
        typeof item.totalKg === "number"
          ? item.totalKg
          : typeof previous?.totalKg === "number"
            ? previous.totalKg
            : null,
      totalRs:
        typeof item.totalRs === "number"
          ? item.totalRs
          : typeof previous?.totalRs === "number"
            ? previous.totalRs
            : null,
    });
  }
  return [...map.values()].sort(compareBudgetListItemsDefault);
}

export async function loadAppConfig(): Promise<AppConfig> {
  const cfg = await loadSyncConfig(import.meta.env.BASE_URL);
  return {
    saveUrl: cfg.saveUrl ?? "",
    syncSecret: cfg.syncSecret ?? "",
  };
}

export function hasRemoteSync(config: AppConfig): boolean {
  return Boolean(config.syncSecret?.trim());
}

function asSyncConfig(config: AppConfig): SyncConfig {
  return {
    saveUrl: config.saveUrl,
    syncSecret: config.syncSecret,
  };
}

export async function saveBudgetRemote(
  budget: BudgetRecord,
  config: AppConfig,
): Promise<{ ok: true; number: string; name: string }> {
  const result = await saveBudgetRemoteShared(budget, asSyncConfig(config), import.meta.env.BASE_URL);
  if (!result.ok || !result.number) {
    throw new Error(result.error || "Falha ao salvar orçamento no servidor.");
  }
  return { ok: true, number: result.number, name: result.name || result.number };
}

export async function listBudgetsRemote(config: AppConfig): Promise<BudgetListItem[]> {
  const result = await listBudgetsRemoteShared(asSyncConfig(config), import.meta.env.BASE_URL);
  if (!result.ok) {
    throw new Error(result.error || "Falha ao listar orçamentos no servidor.");
  }
  return result.items
    .map((row): BudgetListItem | null => {
      const number = String(row.number ?? row.name ?? "").trim();
      if (!number) return null;
      const { clientName, cnpj } = remoteListClientFields(row);
      return {
        id: String(row.id ?? number),
        number,
        name: budgetDisplayName({ number, name: row.name }),
        client: clientName,
        cnpj,
        createdAt: String(row.createdAt ?? ""),
        savedAt: String(row.savedAt ?? row.createdAt ?? ""),
        source: "remote",
        owner: normalizeVendasUser(row.owner),
        totalKg: typeof row.totalKg === "number" ? row.totalKg : null,
        totalRs: typeof row.totalRs === "number" ? row.totalRs : null,
        situacao: normalizeBudgetSituacao(row.situacao),
      };
    })
    .filter((row): row is BudgetListItem => row != null);
}

export async function fetchBudgetRemote(
  number: string,
  config: AppConfig,
): Promise<BudgetRecord> {
  const result = await fetchBudgetRemoteShared(number, asSyncConfig(config), import.meta.env.BASE_URL);
  if (!result.ok || !result.record) {
    throw new Error(result.error || "Falha ao carregar orçamento do servidor.");
  }
  const budget = normalizeBudget({ ...result.record, source: "remote" });
  if (!budget) throw new Error("Orçamento remoto inválido.");
  return budget;
}

export async function deleteBudgetRemote(number: string, config: AppConfig): Promise<void> {
  const result = await deleteBudgetRemoteShared(number, asSyncConfig(config), import.meta.env.BASE_URL);
  if (!result.ok) {
    throw new Error(result.error || "Falha ao excluir orçamento no servidor.");
  }
}

export type { AppConfig, BudgetListItem, BudgetRecord };
export { budgetDisplayName, newBudgetId } from "./budgetTypes";
