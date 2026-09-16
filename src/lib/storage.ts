import type {
  CompareRowInput,
  CompareSession,
  SavedComparison,
  SavedComparisonListItem,
} from './types'
import { DEFAULT_PIS_COFINS } from './types'
import { createEmptyRow } from './calc'
import sampleRows from '../data/sample-rows.json'

const STORAGE_KEY = 'liganer-comparador-preco-draft-v1'
const SAVED_KEY = 'liganer-comparador-preco-saved-v1'

const memory: Record<string, string> = {}

function getItem(key: string, fallback = ''): string {
  try {
    return window.localStorage?.getItem(key) ?? fallback
  } catch {
    return memory[key] ?? fallback
  }
}

function setItem(key: string, value: string): void {
  try {
    window.localStorage?.setItem(key, value)
  } catch {
    memory[key] = value
  }
}

function stripLegacyReference(row: CompareRowInput & { reference?: string }): CompareRowInput {
  const { reference: _reference, ...rest } = row
  return rest
}

export function loadDraft(): CompareSession | null {
  try {
    const raw = getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CompareSession
    if (!parsed || !Array.isArray(parsed.rows)) return null
    return {
      ...parsed,
      rows: parsed.rows.map((row) => stripLegacyReference(row)),
    }
  } catch {
    return null
  }
}

export function saveDraft(session: CompareSession): void {
  setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearDraft(): void {
  try {
    window.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    delete memory[STORAGE_KEY]
  }
}

export function defaultSession(): CompareSession {
  return {
    clientName: '',
    notes: '',
    pisCofins: DEFAULT_PIS_COFINS,
    rows: sampleRows.map((row) => {
      const { reference: _reference, ...rest } = row as typeof row & { reference?: string }
      return createEmptyRow({
        ...rest,
        id: crypto.randomUUID(),
      })
    }),
    updatedAt: new Date().toISOString(),
  }
}

export function localPrintNumber(): string {
  const stamp = new Date()
  const ymd = [
    String(stamp.getFullYear()).slice(2),
    String(stamp.getMonth() + 1).padStart(2, '0'),
    String(stamp.getDate()).padStart(2, '0'),
  ].join('')
  const key = `liganer-comparador-print-${ymd}`
  const next = Number(getItem(key, '0')) + 1
  setItem(key, String(next))
  return `${ymd}${String(next).padStart(2, '0')}`
}

export function loadSavedComparisons(): SavedComparison[] {
  try {
    const list = JSON.parse(getItem(SAVED_KEY, '[]')) as SavedComparison[]
    return list.map((item) => ({
      ...item,
      rows: (item.rows ?? []).map((row) => stripLegacyReference(row)),
    }))
  } catch {
    return []
  }
}

export function pushSavedComparison(record: SavedComparison): void {
  const list = loadSavedComparisons()
  list.push(record)
  setItem(SAVED_KEY, JSON.stringify(list))
}

export function upsertSavedComparison(record: SavedComparison): void {
  const list = loadSavedComparisons()
  const index = list.findIndex(
    (item) => item.id === record.id || item.number === record.number,
  )
  if (index >= 0) list[index] = { ...list[index], ...record }
  else list.push(record)
  setItem(SAVED_KEY, JSON.stringify(list))
}

export function removeSavedComparison(idOrNumber: string): void {
  const key = String(idOrNumber ?? '').trim()
  if (!key) return
  const list = loadSavedComparisons().filter(
    (item) => item.id !== key && item.number !== key,
  )
  setItem(SAVED_KEY, JSON.stringify(list))
}

export function findSavedComparison(idOrNumber: string): SavedComparison | null {
  const key = String(idOrNumber ?? '').trim()
  if (!key) return null
  return (
    loadSavedComparisons().find((item) => item.id === key || item.number === key) ?? null
  )
}

export function savedComparisonsAsListItems(
  records: SavedComparison[] = loadSavedComparisons(),
): SavedComparisonListItem[] {
  return records
    .map((record) => ({
      id: record.id,
      number: record.number,
      name: record.name || record.number,
      clientName: record.clientName ?? '',
      savedAt: record.savedAt ?? record.createdAt,
      createdAt: record.createdAt,
      itemCount: record.rows?.length ?? 0,
    }))
    .sort((a, b) => String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')))
}
