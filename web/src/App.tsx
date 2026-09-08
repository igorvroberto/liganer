import { useEffect, useMemo, useState } from 'react'
import { FilterBar } from './components/FilterBar'
import { LeadDetail } from './components/LeadDetail'
import { LeadTable } from './components/LeadTable'
import { StatsBar } from './components/StatsBar'
import { filterLeads, sortLeads, topAttackList } from './lib/filterLeads'
import { loadLeads } from './lib/loadLeads'
import { EMPTY_FILTERS, type Filters, type Lead } from './types'
import './App.css'

type Tab = 'todos' | 'top20'

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('todos')

  useEffect(() => {
    loadLeads()
      .then((data) => {
        setLeads(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

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
          <p className="sync-note">Dados: GitHub → build → /prospeccao</p>
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
              TOP 20 ordenado por potencial, recorrência, multiproduto, CD e proximidade de
              Araçatuba. Clique para abrir o dossiê.
            </p>
          )}

          <StatsBar all={leads} filtered={view} />

          <div className="workspace">
            <LeadTable
              leads={view}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
            />
            <LeadDetail lead={selected} onClose={() => setSelectedId(null)} />
          </div>
        </>
      ) : null}
    </div>
  )
}
