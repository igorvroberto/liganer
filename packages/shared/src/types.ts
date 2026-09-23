/** Situação comercial na lista de salvos. */
export type BudgetSituacao = 'perdido' | 'analise' | 'ganho'

export type SavedListOwner = {
  id?: string
  email?: string
  name?: string
} | null

/**
 * Forma normalizada da linha na lista (orçamento ou comparação).
 * Cada app adapta o próprio DTO para este formato.
 */
export type SavedListItem = {
  id: string
  name: string
  number?: string | null
  clientName: string
  cnpj?: string | null
  createdAt?: string | null
  savedAt?: string | null
  owner?: SavedListOwner
  totalKg?: number | null
  totalRs?: number | null
  situacao?: BudgetSituacao | null
  /** Metadados opcionais preservados pelo app (não usados pelo shared). */
  meta?: Record<string, unknown>
}

export type SavedSortKey =
  | 'number'
  | 'client'
  | 'cnpj'
  | 'owner'
  | 'totalKg'
  | 'totalRs'
  | 'situacao'
  | 'when'

export type SavedSortState = { key: SavedSortKey; dir: 'asc' | 'desc' }
