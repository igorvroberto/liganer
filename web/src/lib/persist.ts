import Papa from 'papaparse'
import type { Lead } from '../types'

const STORAGE_KEY = 'liganer-prospeccao-leads-v2'

export type LocalStore = {
  leads: Lead[]
  updatedAt: string
}

export function loadLocalLeads(): LocalStore | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalStore
    if (!parsed?.leads?.length) return null
    return parsed
  } catch {
    return null
  }
}

export function saveLocalLeads(leads: Lead[]): void {
  const payload: LocalStore = {
    leads,
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearLocalLeads(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function downloadLeadsCsv(leads: Lead[], filename = 'LEADS.csv'): void {
  const csv = Papa.unparse(leads)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Remove campo legado visita_presencial se vier do CSV antigo */
export function normalizeLead(row: Lead & { visita_presencial?: string }): Lead {
  const { visita_presencial: _drop, ...rest } = row as Lead & { visita_presencial?: string }
  return rest as Lead
}
