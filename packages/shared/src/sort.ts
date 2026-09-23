import { ownerLabel } from './format'
import { normalizeBudgetSituacao, SITUACAO_SORT_ORDER } from './situacao'
import type { SavedListItem, SavedSortKey } from './types'

/** Ordem estável: criação (mais recente primeiro), depois número. Atualizações não reordenam. */
export function compareSavedListItemsDefault(a: SavedListItem, b: SavedListItem): number {
  const created = String(b.createdAt ?? b.savedAt ?? '').localeCompare(
    String(a.createdAt ?? a.savedAt ?? ''),
  )
  if (created !== 0) return created
  return String(b.number ?? b.name ?? '').localeCompare(String(a.number ?? a.name ?? ''), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
}

export function compareSavedListItemsForSort(
  a: SavedListItem,
  b: SavedListItem,
  key: SavedSortKey,
): number {
  const situacaoRank = (item: SavedListItem) =>
    SITUACAO_SORT_ORDER[normalizeBudgetSituacao(item.situacao)]
  switch (key) {
    case 'number':
      return String(a.number ?? a.name ?? '').localeCompare(String(b.number ?? b.name ?? ''), 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      })
    case 'client':
      return String(a.clientName ?? '').localeCompare(String(b.clientName ?? ''), 'pt-BR', {
        sensitivity: 'base',
      })
    case 'cnpj':
      return String(a.cnpj ?? '').localeCompare(String(b.cnpj ?? ''), 'pt-BR')
    case 'owner':
      return ownerLabel(a.owner).localeCompare(ownerLabel(b.owner), 'pt-BR', {
        sensitivity: 'base',
      })
    case 'totalKg':
      return (a.totalKg ?? -1) - (b.totalKg ?? -1)
    case 'totalRs':
      return (a.totalRs ?? -1) - (b.totalRs ?? -1)
    case 'situacao':
      return situacaoRank(a) - situacaoRank(b)
    case 'when':
      return String(a.savedAt || a.createdAt || '').localeCompare(
        String(b.savedAt || b.createdAt || ''),
      )
    default:
      return 0
  }
}

export function sortSavedListItems(
  items: SavedListItem[],
  sort: { key: SavedSortKey; dir: 'asc' | 'desc' } | null,
): SavedListItem[] {
  const list = [...items]
  if (!sort) {
    list.sort(compareSavedListItemsDefault)
    return list
  }
  list.sort((a, b) => {
    const cmp = compareSavedListItemsForSort(a, b, sort.key)
    return sort.dir === 'asc' ? cmp : -cmp
  })
  return list
}

export const SAVED_SORT_HEADERS: { key: SavedSortKey; label: string }[] = [
  { key: 'number', label: 'Número' },
  { key: 'client', label: 'Cliente' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'owner', label: 'Dono' },
  { key: 'totalKg', label: 'Total (Kg)' },
  { key: 'totalRs', label: 'Total (R$)' },
  { key: 'situacao', label: 'Situação' },
  { key: 'when', label: 'Dia/horário' },
]

export const MONTH_OPTIONS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const
