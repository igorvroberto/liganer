import type { CompareSession } from './types'
import { DEFAULT_PIS_COFINS } from './types'
import { createEmptyRow } from './calc'
import sampleRows from '../data/sample-rows.json'

const STORAGE_KEY = 'liganer-comparador-preco-draft-v1'

export function loadDraft(): CompareSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CompareSession
    if (!parsed || !Array.isArray(parsed.rows)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveDraft(session: CompareSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearDraft(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function defaultSession(): CompareSession {
  return {
    clientName: '',
    notes: '',
    pisCofins: DEFAULT_PIS_COFINS,
    rows: sampleRows.map((row) =>
      createEmptyRow({
        ...row,
        id: crypto.randomUUID(),
      }),
    ),
    updatedAt: new Date().toISOString(),
  }
}
