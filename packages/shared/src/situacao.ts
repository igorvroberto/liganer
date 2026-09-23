import type { BudgetSituacao } from './types'

export const BUDGET_SITUACOES: BudgetSituacao[] = ['perdido', 'analise', 'ganho']

export const SITUACAO_OPTIONS: {
  value: BudgetSituacao
  label: string
  symbol: string
  reportTitle: string
}[] = [
  { value: 'perdido', label: 'Perdido', symbol: '✕', reportTitle: 'Perdidos' },
  { value: 'analise', label: 'Em análise', symbol: '!', reportTitle: 'Em análise' },
  { value: 'ganho', label: 'Ganho', symbol: '✓', reportTitle: 'Ganhos' },
]

export const SITUACAO_SORT_ORDER: Record<BudgetSituacao, number> = {
  perdido: 0,
  analise: 1,
  ganho: 2,
}

export function normalizeBudgetSituacao(value: unknown): BudgetSituacao {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'perdido' || raw === 'ganho' || raw === 'analise') return raw
  if (raw === 'análise' || raw === 'em analise' || raw === 'em análise') return 'analise'
  return 'analise'
}
