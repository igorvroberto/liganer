import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  loadSavedComparisons,
  pushSavedComparison,
  savedComparisonsAsListItems,
  upsertSavedComparison,
} from './storage'
import type { SavedComparison } from './types'
import { DEFAULT_PIS_COFINS } from './types'

const SAVED_KEY = 'liganer-comparador-preco-saved-v1'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
      },
    },
  })
})

afterEach(() => {
  store.clear()
  // @ts-expect-error cleanup polyfill
  delete globalThis.window
})

function baseRecord(overrides: Partial<SavedComparison> = {}): SavedComparison {
  return {
    id: 'comparacao-1',
    number: '26091701',
    name: '26091701',
    clientName: 'Cliente Teste',
    notes: '',
    pisCofins: DEFAULT_PIS_COFINS,
    rows: [],
    createdAt: '2026-09-17T10:00:00.000Z',
    savedAt: '2026-09-17T10:00:00.000Z',
    owner: {
      id: 'u1',
      email: 'ana@liganer.com.br',
      name: 'Ana Vendas',
    },
    ...overrides,
  }
}

describe('owner on saved comparisons', () => {
  it('includes owner in list summary', () => {
    pushSavedComparison(baseRecord())
    const list = savedComparisonsAsListItems()
    expect(list).toHaveLength(1)
    expect(list[0].owner).toEqual({
      id: 'u1',
      email: 'ana@liganer.com.br',
      name: 'Ana Vendas',
    })
    expect(list[0].name).toBe('26091701')
  })

  it('preserves original owner on upsert edit', () => {
    pushSavedComparison(baseRecord())
    upsertSavedComparison(
      baseRecord({
        savedAt: '2026-09-17T12:00:00.000Z',
        clientName: 'Cliente Atualizado',
        owner: {
          id: 'u1',
          email: 'ana@liganer.com.br',
          name: 'Ana Vendas',
        },
      }),
    )
    const [record] = loadSavedComparisons()
    expect(record.clientName).toBe('Cliente Atualizado')
    expect(record.owner?.email).toBe('ana@liganer.com.br')
    expect(store.get(SAVED_KEY)).toContain('ana@liganer.com.br')
  })
})
