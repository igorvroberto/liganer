import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilterBar } from './components/FilterBar'
import { LeadDetail } from './components/LeadDetail'
import { LeadTable } from './components/LeadTable'
import { StatsBar } from './components/StatsBar'
import { filterLeads, topAttackList } from './lib/filterLeads'
import { loadLeads, type LeadsSource } from './lib/loadLeads'
import {
  clearLocalLeads,
  downloadLeadsCsv,
  loadLocalLeads,
  normalizeLead,
  saveLocalLeads,
} from './lib/persist'
import { createSyncQueue, loadSyncConfig, type SyncConfig } from './lib/syncApi'
import { EMPTY_FILTERS, type Filters, type Lead } from './types'
import './App.css'

type Tab = 'todos' | 'top20'
type SyncUi = { state: 'idle' | 'saving' | 'saved' | 'error' | 'local-only'; detail?: string }

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [source, setSource] = useState<LeadsSource | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('todos')
  const [syncCfg, setSyncCfg] = useState<SyncConfig>({})
  const [syncUi, setSyncUi] = useState<SyncUi>({ state: 'idle' })
  const syncQueue = useRef(createSyncQueue(1200))

  const autoSync = Boolean(syncCfg.syncSecret)

  const onSyncStatus = useCallback((s: 'saving' | 'saved' | 'error', detail?: string) => {
    setSyncUi({ state: s, detail })
    if (s === 'saved') {
      clearLocalLeads()
      setDirty(false)
    }
  }, [])

  const queueSync = useCallback(
    (next: Lead[], opts?: { immediate?: boolean; message?: string }) => {
      saveLocalLeads(next)
      setDirty(true)
      if (!syncCfg.syncSecret) {
        setSyncUi({
          state: 'local-only',
          detail: 'Alteração só neste navegador — configure o sync (deploy/README.md)',
        })
        return
      }
      syncQueue.current.schedule(next, syncCfg, onSyncStatus, opts)
    },
    [syncCfg, onSyncStatus],
  )

  const applyLeads = useCallback((next: Lead[], markDirty: boolean) => {
    const normalized = next.map((l) => normalizeLead(l as Lead & { visita_presencial?: string }))
    setLeads(normalized)
    if (markDirty) {
      saveLocalLeads(normalized)
      setDirty(true)
    }
  }, [])

  const refresh = useCallback(
    (preferLocal = true) => {
      setLoading(true)
      setError(null)
      Promise.all([loadLeads(), loadSyncConfig()])
        .then(([{ leads: data, source: src }, cfg]) => {
          setSyncCfg(cfg)
          const remote = data.map((l) =>
            normalizeLead(l as Lead & { visita_presencial?: string }),
          )
          const local = preferLocal ? loadLocalLeads() : null
          if (local?.leads?.length) {
            applyLeads(local.leads, true)
            setSource({ ...src, label: `${src.label} + pendências locais` })
            setFetchedAt(new Date(local.updatedAt).toLocaleString('pt-BR'))
            setDirty(true)
            if (cfg.syncSecret) {
              syncQueue.current.schedule(local.leads, cfg, onSyncStatus, {
                immediate: true,
                message: 'Reenvia edições locais pendentes',
              })
            } else {
              setSyncUi({
                state: 'local-only',
                detail: 'Há edições locais — sync automático ainda não configurado',
              })
            }
          } else {
            setLeads(remote)
            setSource(src)
            setFetchedAt(new Date().toLocaleString('pt-BR'))
            setDirty(false)
            setSyncUi({
              state: cfg.syncSecret ? 'idle' : 'local-only',
              detail: cfg.syncSecret
                ? undefined
                : 'Sync automático off — edições ficam só neste navegador até configurar',
            })
          }
          setLoading(false)
        })
        .catch((err: Error) => {
          const local = loadLocalLeads()
          if (local?.leads?.length) {
            applyLeads(local.leads, true)
            setSource({ url: 'localStorage', label: 'Edições locais (offline)' })
            setFetchedAt(new Date(local.updatedAt).toLocaleString('pt-BR'))
            setLoading(false)
            return
          }
          setError(err.message)
          setLoading(false)
        })
    },
    [applyLeads, onSyncStatus],
  )

  useEffect(() => {
    refresh(true)
  }, [refresh])

  const onPatch = useCallback(
    (id: string, patch: Partial<Lead>) => {
      setLeads((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
        queueSync(next)
        return next
      })
    },
    [queueSync],
  )

  const discardLocal = () => {
    if (!confirm('Descartar edições locais não sincronizadas e recarregar do servidor?')) return
    clearLocalLeads()
    setDirty(false)
    setSyncUi({ state: 'idle' })
    refresh(false)
  }

  const filtered = useMemo(() => filterLeads(leads, filters), [leads, filters])
  const top20 = useMemo(() => topAttackList(leads, 20), [leads])
  const view = tab === 'top20' ? top20 : filtered
  const selected = leads.find((l) => l.id === selectedId) ?? null

  const syncLabel =
    syncUi.state === 'saving'
      ? 'Salvando…'
      : syncUi.state === 'saved'
        ? syncUi.detail ?? 'Salvo'
        : syncUi.state === 'error'
          ? `Erro ao salvar: ${syncUi.detail ?? ''}`
          : syncUi.state === 'local-only'
            ? syncUi.detail ?? 'Só neste navegador'
            : autoSync
              ? 'Sync automático ativo'
              : null

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Liganer</span>
          <div>
            <h1>Prospecção</h1>
            <p>Radar comercial · aço e metalurgia · Araçatuba</p>
          </div>
        </div>
        <div className="topbar-right">
          <nav className="tabs" aria-label="Visões">
            <button
              type="button"
              className={tab === 'todos' ? 'active' : undefined}
              onClick={() => setTab('todos')}
            >
              Todos / filtros
            </button>
            <button
              type="button"
              className={tab === 'top20' ? 'active' : undefined}
              onClick={() => setTab('top20')}
            >
              TOP 20 ataque
            </button>
          </nav>
          <div className="sync-note">
            <span>
              Fonte: {source?.label ?? '…'}
              {fetchedAt ? ` · ${fetchedAt}` : ''}
              {dirty ? ' · pendente' : ''}
            </span>
            {syncLabel ? (
              <span
                className={
                  syncUi.state === 'error'
                    ? 'sync-pill sync-error'
                    : syncUi.state === 'saved'
                      ? 'sync-pill sync-ok'
                      : syncUi.state === 'saving'
                        ? 'sync-pill sync-saving'
                        : 'sync-pill'
                }
              >
                {syncLabel}
              </span>
            ) : null}
            <button type="button" className="btn ghost btn-sm" onClick={() => refresh(true)} disabled={loading}>
              Atualizar
            </button>
            <button
              type="button"
              className="btn ghost btn-sm"
              onClick={() => downloadLeadsCsv(leads)}
              disabled={!leads.length}
            >
              Baixar CSV
            </button>
            {dirty ? (
              <button type="button" className="btn ghost btn-sm" onClick={discardLocal}>
                Descartar edições
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {loading ? <p className="status">Carregando leads…</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      {!loading && !error ? (
        <>
          {tab === 'todos' ? (
            <FilterBar
              leads={leads}
              filters={filters}
              onChange={setFilters}
              onClear={() => setFilters(EMPTY_FILTERS)}
            />
          ) : (
            <p className="banner">
              TOP 20 ordenado por potencial, recorrência, corte/dobra e proximidade. Datas e status
              editam na tabela; demais campos no painel.
            </p>
          )}

          <StatsBar all={leads} filtered={view} />

          <div className="workspace">
            <LeadTable
              leads={view}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              onPatch={onPatch}
            />
            <LeadDetail
              lead={selected}
              onClose={() => setSelectedId(null)}
              onPatch={onPatch}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
