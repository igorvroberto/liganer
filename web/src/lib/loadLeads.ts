import Papa from 'papaparse'
import type { Lead } from '../types'

export type LeadsSource = {
  url: string
  label: string
}

type RuntimeConfig = {
  /** URL absoluta do CSV (GitHub raw público, gist, etc.) */
  leadsUrl?: string
  leadsLabel?: string
}

function parseCsv(text: string): Lead[] {
  const parsed = Papa.parse<Lead>(text, {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length) {
    console.warn('CSV parse warnings', parsed.errors.slice(0, 3))
  }
  return parsed.data.filter((row) => row.id && row.empresa)
}

async function fetchText(url: string): Promise<string> {
  const sep = url.includes('?') ? '&' : '?'
  const bust = `${sep}t=${Date.now()}`
  const res = await fetch(`${url}${bust}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`)
  return res.text()
}

async function loadRuntimeConfig(): Promise<RuntimeConfig | null> {
  try {
    const url = `${import.meta.env.BASE_URL}config.json`
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as RuntimeConfig
  } catch {
    return null
  }
}

/**
 * Ordem:
 * 1) config.json na hospedagem (leadsUrl)
 * 2) VITE_LEADS_URL no build
 * 3) CSV local /data/leads.csv (espelho FTP / dev)
 *
 * Repo privado: use o Action de FTP para espelhar o CSV do GitHub
 * na hospedagem; o app lê o espelho local (protegido por senha).
 */
export async function resolveLeadsSource(): Promise<LeadsSource> {
  const runtime = await loadRuntimeConfig()
  if (runtime?.leadsUrl) {
    return {
      url: runtime.leadsUrl,
      label: runtime.leadsLabel ?? 'GitHub (config.json)',
    }
  }

  const envUrl = import.meta.env.VITE_LEADS_URL as string | undefined
  if (envUrl) {
    return { url: envUrl, label: 'GitHub (build)' }
  }

  return {
    url: `${import.meta.env.BASE_URL}data/leads.csv`,
    label: 'GitHub → FTP (espelho local)',
  }
}

export async function loadLeads(): Promise<{ leads: Lead[]; source: LeadsSource }> {
  const source = await resolveLeadsSource()
  try {
    const text = await fetchText(source.url)
    return { leads: parseCsv(text), source }
  } catch (err) {
    // Fallback: se URL remota falhar, tenta o CSV local da hospedagem
    const local: LeadsSource = {
      url: `${import.meta.env.BASE_URL}data/leads.csv`,
      label: 'Fallback local (FTP)',
    }
    if (source.url === local.url) throw err
    const text = await fetchText(local.url)
    return { leads: parseCsv(text), source: local }
  }
}
