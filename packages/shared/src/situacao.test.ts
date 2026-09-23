import { describe, expect, it } from 'vitest'
import {
  compareBudgetsOldestFirst,
  filterBudgetsByMonthYear,
  normalizeBudgetSituacao,
  pageCount,
  slicePage,
  sortSavedListItems,
  type SavedListItem,
} from './index'

function item(partial: Partial<SavedListItem> & Pick<SavedListItem, 'id' | 'name'>): SavedListItem {
  return {
    clientName: '',
    ...partial,
  }
}

describe('normalizeBudgetSituacao', () => {
  it('normalizes aliases and defaults', () => {
    expect(normalizeBudgetSituacao('ganho')).toBe('ganho')
    expect(normalizeBudgetSituacao('em análise')).toBe('analise')
    expect(normalizeBudgetSituacao('')).toBe('analise')
  })
})

describe('sort and pagination', () => {
  const items = [
    item({ id: '1', name: 'a', createdAt: '2026-01-02T10:00:00.000Z', totalRs: 10 }),
    item({ id: '2', name: 'b', createdAt: '2026-01-03T10:00:00.000Z', totalRs: 5 }),
    item({ id: '3', name: 'c', createdAt: '2026-01-01T10:00:00.000Z', totalRs: 20 }),
  ]

  it('defaults to newest createdAt first', () => {
    expect(sortSavedListItems(items, null).map((x) => x.id)).toEqual(['2', '1', '3'])
  })

  it('sorts by totalRs ascending when requested', () => {
    expect(
      sortSavedListItems(items, { key: 'totalRs', dir: 'asc' }).map((x) => x.id),
    ).toEqual(['2', '1', '3'])
  })

  it('paginates 10 per page', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      item({ id: String(i), name: String(i), createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` }),
    )
    expect(pageCount(many.length)).toBe(3)
    expect(slicePage(sortSavedListItems(many, null), 1)).toHaveLength(10)
    expect(slicePage(sortSavedListItems(many, null), 3)).toHaveLength(5)
  })
})

describe('situacao report helpers', () => {
  const items = [
    item({
      id: '1',
      name: 'old',
      createdAt: '2026-03-01T12:00:00.000Z',
      situacao: 'ganho',
    }),
    item({
      id: '2',
      name: 'new',
      createdAt: '2026-03-15T12:00:00.000Z',
      situacao: 'ganho',
    }),
    item({
      id: '3',
      name: 'other-month',
      createdAt: '2026-02-01T12:00:00.000Z',
      situacao: 'perdido',
    }),
  ]

  it('filters by month/year and sorts oldest first', () => {
    const filtered = filterBudgetsByMonthYear(items, 3, 2026)
    expect(filtered.map((x) => x.id)).toEqual(['1', '2'])
    expect([...filtered].sort(compareBudgetsOldestFirst).map((x) => x.id)).toEqual(['1', '2'])
  })
})
