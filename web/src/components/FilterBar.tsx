import type { Filters, Lead } from '../types'
import {
  CATEGORIA_OPTIONS,
  LINHA_OPTIONS,
  POTENCIAL_OPTIONS,
  RAIO_MAX_KM,
  SITUACAO_OPTIONS,
  STATUS_OPTIONS,
} from '../types'
import { uniqueSorted } from '../lib/filterLeads'

type Props = {
  leads: Lead[]
  filters: Filters
  onChange: (next: Filters) => void
  onClear: () => void
}

export function FilterBar({ leads, filters, onChange, onClear }: Props) {
  const cidades = uniqueSorted(leads.map((l) => l.cidade))
  const categorias = [
    ...CATEGORIA_OPTIONS,
    ...uniqueSorted(leads.map((l) => l.categoria)).filter(
      (c) => !(CATEGORIA_OPTIONS as readonly string[]).includes(c),
    ),
  ]
  const situacoes = [
    ...SITUACAO_OPTIONS,
    ...uniqueSorted(leads.map((l) => l.situacao)).filter(
      (s) => !(SITUACAO_OPTIONS as readonly string[]).includes(s),
    ),
  ]
  const statuses = [
    ...STATUS_OPTIONS,
    ...uniqueSorted(leads.map((l) => l.status)).filter(
      (s) => !(STATUS_OPTIONS as readonly string[]).includes(s),
    ),
  ]

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value })

  return (
    <section className="filters" aria-label="Filtros">
      <div className="filters-grid">
        <label className="field field-search">
          <span>Busca</span>
          <input
            type="search"
            placeholder="Empresa, CNPJ, produto, telefone, motivo…"
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
          />
        </label>

        <label className="field field-raio">
          <span>
            Raio · até <strong>{filters.raioKm} km</strong> de Araçatuba
          </span>
          <input
            type="range"
            min={0}
            max={RAIO_MAX_KM}
            step={10}
            value={filters.raioKm}
            onChange={(e) => set('raioKm', Number(e.target.value))}
            aria-valuemin={0}
            aria-valuemax={RAIO_MAX_KM}
            aria-valuenow={filters.raioKm}
            aria-label="Raio máximo em quilômetros a partir de Araçatuba"
          />
          <div className="raio-scale" aria-hidden>
            <span>0</span>
            <span>100</span>
            <span>200</span>
          </div>
        </label>

        <label className="field">
          <span>Linha</span>
          <select value={filters.linha} onChange={(e) => set('linha', e.target.value)}>
            <option value="">Todas</option>
            {LINHA_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Categoria</span>
          <select value={filters.categoria} onChange={(e) => set('categoria', e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Potencial</span>
          <select value={filters.potencial} onChange={(e) => set('potencial', e.target.value)}>
            <option value="">Todos</option>
            {POTENCIAL_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Cidade</span>
          <select value={filters.cidade} onChange={(e) => set('cidade', e.target.value)}>
            <option value="">Todas</option>
            {cidades.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Situação</span>
          <select value={filters.situacao} onChange={(e) => set('situacao', e.target.value)}>
            <option value="">Todas</option>
            {situacoes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Status</span>
          <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Todos</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filters-actions">
        <button type="button" className="btn ghost" onClick={onClear}>
          Limpar filtros
        </button>
      </div>
    </section>
  )
}
