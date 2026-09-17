import type { QuoteClientInfo } from "./quoteClient";
import type { QuoteConditions, QuoteSummary } from "./quoteSummary";
import type { BlankInput } from "./types";
import type { VendasUser } from "./vendasAuth";

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
