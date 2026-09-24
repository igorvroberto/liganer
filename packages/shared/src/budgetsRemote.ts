/**
 * Cliente HTTP compartilhado para api/budgets.php (X-Sync-Secret).
 * Não contém lógica de cálculo — só sync remoto.
 */

export type SyncConfig = {
  saveUrl?: string
  printNumberUrl?: string
  syncSecret?: string
}

export type RemoteBudgetListItem = {
  id: string
  number?: string | null
  name?: string | null
  client?: { name?: string; cnpj?: string } | string | null
  cnpj?: string | null
  createdAt?: string | null
  savedAt?: string | null
  source?: string | null
  owner?: { id?: string; email?: string; name?: string } | null
  totalKg?: number | null
  totalRs?: number | null
  situacao?: string | null
}

export function budgetsApiUrl(config: SyncConfig, baseUrl: string): string {
  if (config.saveUrl?.trim()) return config.saveUrl.trim()
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return `${base}api/budgets.php`
}

export async function loadSyncConfig(baseUrl: string): Promise<SyncConfig> {
  try {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    const res = await fetch(`${base}config.json`, { cache: 'no-store' })
    if (!res.ok) return {}
    const json = (await res.json()) as SyncConfig
    return {
      saveUrl: typeof json.saveUrl === 'string' ? json.saveUrl.trim() : undefined,
      printNumberUrl:
        typeof json.printNumberUrl === 'string' ? json.printNumberUrl.trim() : undefined,
      syncSecret: typeof json.syncSecret === 'string' ? json.syncSecret.trim() : undefined,
    }
  } catch {
    return {}
  }
}

export async function saveBudgetRemote(
  record: unknown,
  config: SyncConfig,
  baseUrl: string,
): Promise<{ ok: boolean; number?: string; name?: string; error?: string }> {
  if (!config.syncSecret) {
    return {
      ok: false,
      error: 'Sync não configurado (sem syncSecret). Salvo só neste navegador.',
    }
  }
  try {
    const res = await fetch(budgetsApiUrl(config, baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Secret': config.syncSecret,
      },
      body: JSON.stringify(record),
    })
    const data = (await res.json().catch(() => ({}))) as {
      number?: string
      name?: string
      error?: string
    }
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, number: data.number, name: data.name }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

export async function fetchBudgetRemote(
  number: string,
  config: SyncConfig,
  baseUrl: string,
): Promise<{ ok: boolean; record?: Record<string, unknown>; error?: string }> {
  const trimmed = String(number ?? '').trim()
  if (!trimmed) return { ok: false, error: 'Número inválido.' }
  if (!config.syncSecret) return { ok: false, error: 'Sync não configurado.' }
  try {
    const url = new URL(budgetsApiUrl(config, baseUrl), window.location.origin)
    url.searchParams.set('number', trimmed)
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'X-Sync-Secret': config.syncSecret },
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
      error?: string
    }
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true, record: data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

export async function deleteBudgetRemote(
  number: string,
  config: SyncConfig,
  baseUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = String(number ?? '').trim()
  if (!trimmed) return { ok: false, error: 'Número inválido.' }
  if (!config.syncSecret) return { ok: false, error: 'Sync não configurado.' }
  try {
    const url = new URL(budgetsApiUrl(config, baseUrl), window.location.origin)
    url.searchParams.set('number', trimmed)
    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { 'X-Sync-Secret': config.syncSecret },
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha de rede' }
  }
}

export async function listBudgetsRemote(
  config: SyncConfig,
  baseUrl: string,
): Promise<{ ok: boolean; items: RemoteBudgetListItem[]; error?: string }> {
  if (!config.syncSecret) {
    return { ok: false, items: [], error: 'Sync não configurado.' }
  }
  try {
    const res = await fetch(budgetsApiUrl(config, baseUrl), {
      method: 'GET',
      headers: { 'X-Sync-Secret': config.syncSecret },
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => ({}))) as {
      items?: RemoteBudgetListItem[]
      error?: string
    }
    if (!res.ok) return { ok: false, items: [], error: data.error || `HTTP ${res.status}` }
    return { ok: true, items: Array.isArray(data.items) ? data.items : [] }
  } catch (err) {
    return {
      ok: false,
      items: [],
      error: err instanceof Error ? err.message : 'Falha de rede',
    }
  }
}

/** Normaliza client flat (blanks) ou objeto (chapas/ace) a partir do item remoto. */
export function remoteListClientFields(item: RemoteBudgetListItem): {
  clientName: string
  cnpj: string
} {
  if (item.client && typeof item.client === 'object') {
    return {
      clientName: String(item.client.name ?? ''),
      cnpj: String(item.client.cnpj ?? ''),
    }
  }
  return {
    clientName: String(item.client ?? ''),
    cnpj: String(item.cnpj ?? ''),
  }
}
