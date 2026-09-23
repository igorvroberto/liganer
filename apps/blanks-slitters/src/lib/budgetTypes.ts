import type { BudgetSituacao, SavedListItem } from "@liganer/shared";
import {
  compareSavedListItemsDefault,
  normalizeBudgetSituacao,
  pickFiniteNumber,
} from "@liganer/shared";
import type { QuoteClientInfo } from "./quoteClient";
import type { QuoteConditions, QuoteSummary } from "./quoteSummary";
import type { BlankInput } from "./types";
import type { VendasUser } from "./vendasAuth";

export type { BudgetSituacao };

export type BudgetSource = "local" | "remote";

/** Orçamento completo persistido (local e/ou servidor). */
export type BudgetRecord = {
  id: string;
  /** Número AAMMDD + seq (ex.: 26091401). Também é o nome exibido. */
  number: string;
  name: string;
  client: QuoteClientInfo;
  items: BlankInput[];
  conditions: QuoteConditions;
  demandModes: Record<string, "qty" | "weight">;
  allowOvershoot: boolean;
  summary: QuoteSummary;
  createdAt: string;
  savedAt: string;
  source: BudgetSource;
  /** Usuário que criou o orçamento (não muda na edição). */
  owner?: VendasUser | null;
  situacao?: BudgetSituacao;
};

/** Linha da lista Orçamentos salvos. */
export type BudgetListItem = {
  id: string;
  number: string;
  name: string;
  client: string;
  cnpj: string;
  createdAt: string;
  savedAt: string;
  source: BudgetSource;
  owner?: VendasUser | null;
  totalKg?: number | null;
  totalRs?: number | null;
  situacao?: BudgetSituacao | null;
};

export type AppConfig = {
  saveUrl?: string;
  syncSecret?: string;
};

export function budgetDisplayName(budget: {
  number?: string | null;
  name?: string | null;
}): string {
  const number = String(budget.number ?? "").trim();
  if (number) return number;
  return String(budget.name ?? "").trim();
}

export function newBudgetId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `budget-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function toSavedListItem(item: BudgetListItem): SavedListItem {
  return {
    id: item.id,
    name: item.name,
    number: item.number,
    clientName: item.client ?? "",
    cnpj: item.cnpj ?? "",
    createdAt: item.createdAt,
    savedAt: item.savedAt,
    owner: item.owner,
    totalKg: item.totalKg ?? null,
    totalRs: item.totalRs ?? null,
    situacao: normalizeBudgetSituacao(item.situacao),
  };
}

export function compareBudgetListItemsDefault(a: BudgetListItem, b: BudgetListItem): number {
  return compareSavedListItemsDefault(toSavedListItem(a), toSavedListItem(b));
}

export function listTotalsFromSummary(summary: QuoteSummary | undefined | null): {
  totalKg: number | null;
  totalRs: number | null;
} {
  return {
    totalKg: pickFiniteNumber(summary?.totalKg),
    totalRs: pickFiniteNumber(summary?.total),
  };
}

export { normalizeBudgetSituacao };
