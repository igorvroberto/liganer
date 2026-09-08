import Papa from 'papaparse'
import type { Lead } from '../types'

export async function loadLeads(): Promise<Lead[]> {
  const url = `${import.meta.env.BASE_URL}data/leads.csv`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao carregar leads (${res.status})`)
  const text = await res.text()
  const parsed = Papa.parse<Lead>(text, {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length) {
    console.warn('CSV parse warnings', parsed.errors.slice(0, 3))
  }
  return parsed.data.filter((row) => row.id && row.empresa)
}
