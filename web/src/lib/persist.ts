import Papa from 'papaparse'
import type { Lead } from '../types'
import { SITUACAO_OPTIONS } from '../types'

const STORAGE_KEY = 'liganer-prospeccao-leads-v3'

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

function mapSituacao(value: string | undefined): string {
  const s = (value ?? '').trim()
  if ((SITUACAO_OPTIONS as readonly string[]).includes(s)) return s
  if (s === 'Sem interesse' || s === 'Sem contato') return 'Desqualificado'
  if (!s) return 'Qualificado'
  // valores antigos do funil (Lead qualificado, Pesquisado, Cliente, etc.)
  return 'Qualificado'
}

/** Remove campos legados e normaliza situação */
export function normalizeLead(
  row: Lead & { visita_presencial?: string; classificacao_comercial?: string },
): Lead {
  const {
    visita_presencial: _v,
    classificacao_comercial: _c,
    ...rest
  } = row as Lead & {
    visita_presencial?: string
    classificacao_comercial?: string
  }
  return {
    ...rest,
    ultima_compra: rest.ultima_compra ?? '',
    situacao: mapSituacao(rest.situacao),
  } as Lead
}
