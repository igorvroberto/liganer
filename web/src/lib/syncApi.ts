import type { Lead } from '../types'

export type SyncConfig = {
  syncSecret?: string
  syncApiUrl?: string
}

export type SyncResult = {
  ok: boolean
  count?: number
  local?: boolean
  github?: boolean
  github_error?: string | null
  commit?: string | null
  error?: string
}

export async function loadSyncConfig(): Promise<SyncConfig> {
  try {
    const url = `${import.meta.env.BASE_URL}config.json?t=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return {}
    return (await res.json()) as SyncConfig
  } catch {
    return {}
  }
}

export function resolveSyncApiUrl(cfg: SyncConfig): string {
  if (cfg.syncApiUrl) return cfg.syncApiUrl
  return `${import.meta.env.BASE_URL}api/leads.php`
}

export async function pushLeadsToServer(
  leads: Lead[],
  cfg: SyncConfig,
  message?: string,
): Promise<SyncResult> {
  if (!cfg.syncSecret) {
    return { ok: false, error: 'Sync automático não configurado (sem syncSecret).' }
  }

  const res = await fetch(resolveSyncApiUrl(cfg), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Secret': cfg.syncSecret,
    },
    body: JSON.stringify({ leads, message }),
  })

  let data: SyncResult
  try {
    data = (await res.json()) as SyncResult
  } catch {
    return { ok: false, error: `HTTP ${res.status} (resposta inválida)` }
  }

  if (!res.ok || !data.ok) {
    return {
      ok: false,
      error: data.error ?? data.github_error ?? `HTTP ${res.status}`,
      github: data.github,
      local: data.local,
    }
  }

  return data
}

/** Agenda um push; cancela o anterior se ainda não disparou. */
export function createSyncQueue(delayMs = 1200) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: Lead[] | null = null
  let message: string | undefined
  let inFlight: Promise<SyncResult> | null = null

  const flush = async (
    cfg: SyncConfig,
    onStatus: (s: 'saving' | 'saved' | 'error', detail?: string) => void,
  ): Promise<SyncResult | null> => {
    if (!pending) return null
    const leads = pending
    const msg = message
    pending = null
    message = undefined
    onStatus('saving')
    try {
      inFlight = pushLeadsToServer(leads, cfg, msg)
      const result = await inFlight
      inFlight = null
      if (result.ok) {
        onStatus(
          'saved',
          result.github
            ? 'Salvo no servidor e no GitHub'
            : result.local
              ? 'Salvo no servidor (GitHub pendente)'
              : 'Salvo',
        )
      } else {
        onStatus('error', result.error ?? 'Falha ao salvar')
      }
      return result
    } catch (err) {
      inFlight = null
      const detail = err instanceof Error ? err.message : 'Falha de rede'
      onStatus('error', detail)
      return { ok: false, error: detail }
    }
  }

  return {
    schedule(
      leads: Lead[],
      cfg: SyncConfig,
      onStatus: (s: 'saving' | 'saved' | 'error', detail?: string) => void,
      opts?: { immediate?: boolean; message?: string },
    ) {
      pending = leads
      message = opts?.message
      if (timer) clearTimeout(timer)
      if (opts?.immediate) {
        void flush(cfg, onStatus)
        return
      }
      timer = setTimeout(() => {
        timer = null
        void flush(cfg, onStatus)
      }, delayMs)
    },
    async flushNow(
      cfg: SyncConfig,
      onStatus: (s: 'saving' | 'saved' | 'error', detail?: string) => void,
    ) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (inFlight) await inFlight
      return flush(cfg, onStatus)
    },
  }
}
