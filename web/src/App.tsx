import { useCallback, useEffect, useMemo, useState } from 'react'
import { FilterBar } from './components/FilterBar'
import { LeadDetail } from './components/LeadDetail'
import { LeadTable } from './components/LeadTable'
import { StatsBar } from './components/StatsBar'
import { filterLeads, sortLeads, topAttackList } from './lib/filterLeads'
import { loadLeads, type LeadsSource } from './lib/loadLeads'
import {
  clearLocalLeads,
  downloadLeadsCsv,
  loadLocalLeads,
  normalizeLead,
  saveLocalLeads,
} from './lib/persist'
import { EMPTY_FILTERS, type Filters, type Lead } from './types'
import './App.css'

type Tab = 'todos' | 'top20'

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
      loadLeads()
        .then(({ leads: data, source: src }) => {
          const remote = data.map((l) =>
            normalizeLead(l as Lead & { visita_presencial?: string }),
          )
          const local = preferLocal ? loadLocalLeads() : null
          if (local?.leads?.length) {
            applyLeads(local.leads, true)
            setSource({ ...src, label: `${src.label} + edições locais` })
            setFetchedAt(new Date(local.updatedAt).toLocaleString('pt-BR'))
            setDirty(true)
          } else {
            setLeads(remote)
            setSource(src)
            setFetchedAt(new Date().toLocaleString('pt-BR'))
            setDirty(false)
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
    [applyLeads],
  )

  useEffect(() => {
    refresh(true)
  }, [refresh])

  const onPatch = useCallback(
    (id: string, patch: Partial<Lead>) => {
      setLeads((prev) => {
        const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
        saveLocalLeads(next)
        return next
      })
      setDirty(true)
    },
    [],
  )

  const onDelete = useCallback(
    (id: string) => {
      setLeads((prev) => {
        const next = prev.filter((l) => l.id !== id)
        saveLocalLeads(next)
        return next
      })
      setSelectedId((cur) => (cur === id ? null : cur))
      setDirty(true)
    },
    [],
  )

  const discardLocal = () => {
    if (!confirm('Descartar todas as edições locais e recarregar do GitHub/FTP?')) return
    clearLocalLeads()
    setDirty(false)
    refresh(false)
  }

  const filtered = useMemo(() => sortLeads(filterLeads(leads, filters)), [leads, filters])
  const top20 = useMemo(() => topAttackList(leads, 20), [leads])
  const view = tab === 'top20' ? top20 : filtered
  const selected = leads.find((l) => l.id === selectedId) ?? null

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
              {dirty ? ' · alterações locais' : ''}
            </span>
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
              TOP 20 ordenado por potencial, recorrência, multiproduto, CD e proximidade. Edite
              direto na tabela ou no painel.
            </p>
          )}

          <StatsBar all={leads} filtered={view} />

          <div className="workspace">
            <LeadTable
              leads={view}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              onPatch={onPatch}
              onDelete={onDelete}
            />
            <LeadDetail
              lead={selected}
              onClose={() => setSelectedId(null)}
              onPatch={onPatch}
              onDelete={onDelete}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
