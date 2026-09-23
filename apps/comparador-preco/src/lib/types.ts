/** Constantes e tipos do comparador (planilha Diferença preço e ICMS). */

import type { BudgetSituacao } from '@liganer/shared'

export type { BudgetSituacao }

export const DEFAULT_PIS_COFINS = 0.0925

export type CompareRowInput = {
  id: string
  qty: number | ''
  unit: string
  ourProduct: string
  ourIcms: number | ''
  factorUsed: number | ''
  observation: string
  competitor: string
  clientProduct: string
  clientPrice: number | ''
  clientIcms: number | ''
  /** Preço fator 100 (coluna O da planilha). */
  priceFactor100: number | ''
}

export type CompareRowComputed = {
  ourPrice: number | null
  equivalentPrice: number | null
  priceDiff: number | null
  targetPrice: number | null
  targetFactor: number | null
  origin: number | null
  destination: number | null
}

export type CompareRow = CompareRowInput & CompareRowComputed

export type CompareSession = {
  clientName: string
  notes: string
  pisCofins: number
  rows: CompareRowInput[]
  updatedAt: string
}

/** Usuário logado em vendas.liganer.com.br que salvou. */
export type ComparisonOwner = {
  id: string
  email: string
  name: string
}

export type SavedComparison = {
  id: string
  number: string
  name: string
  clientName: string
  notes: string
  pisCofins: number
  rows: CompareRowInput[]
  createdAt: string
  savedAt: string
  owner?: ComparisonOwner | null
  situacao?: BudgetSituacao
}

export type SavedComparisonListItem = {
  id: string
  number: string
  name: string
  clientName: string
  savedAt: string
  createdAt: string
  itemCount: number
  owner?: ComparisonOwner | null
  totalKg?: number | null
  totalRs?: number | null
  situacao?: BudgetSituacao | null
}

/** Totais derivados das linhas da comparação. */
export function comparisonListTotals(rows: CompareRowInput[] | undefined | null): {
  totalKg: number | null
  totalRs: number | null
} {
  let totalKg = 0
  let withKg = 0
  let totalRs = 0
  let withRs = 0
  for (const row of rows ?? []) {
    const qty = typeof row.qty === 'number' && Number.isFinite(row.qty) ? row.qty : null
    const unit = String(row.unit ?? '')
      .trim()
      .toLowerCase()
    if (qty != null && (unit === 'kg' || unit === 'kgs' || /\bkg\b/.test(unit))) {
      totalKg += qty
      withKg += 1
    }
    const price =
      typeof row.clientPrice === 'number' && Number.isFinite(row.clientPrice)
        ? row.clientPrice
        : null
    if (qty != null && price != null) {
      totalRs += qty * price
      withRs += 1
    }
  }
  return {
    totalKg: withKg > 0 ? totalKg : null,
    totalRs: withRs > 0 ? totalRs : null,
  }
}
