import { useEffect, useMemo } from 'react'
import type { Filters, Lead } from '../types'
import {
  CATEGORIA_OPTIONS,
  LINHA_OPTIONS,
  POTENCIAL_OPTIONS,
  SITUACAO_OPTIONS,
  STATUS_OPTIONS,
  raioMaxFromLeads,
} from '../types'
import { uniqueSorted } from '../lib/filterLeads'
import { formatLinha, parseLinha } from '../lib/linha'

type Props = {
  leads: Lead[]
  filters: Filters
  onChange: (next: Filters) => void
  onClear: () => void
}

export function FilterBar({ leads, filters, onChange, onClear }: Props) {
  const raioMax = useMemo(() => raioMaxFromLeads(leads), [leads])
  const mid = Math.round(raioMax / 2 / 10) * 10

  useEffect(() => {
    if (filters.raioKm > raioMax) {
      onChange({ ...filters, raioKm: raioMax })
    }
    // Só ajusta quando o teto do raio muda (cidade mais longe).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evita loop com onChange/filters
  }, [raioMax])

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
  const indicacoes = uniqueSorted(leads.map((l) => (l.indicacao ?? '').trim()))
  const temSemIndicacao = leads.some((l) => !(l.indicacao ?? '').trim())

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value })

  const linhasFiltro = parseLinha(filters.linha)
  const toggleLinhaFiltro = (opt: string) => {
    const next = linhasFiltro.includes(opt as (typeof LINHA_OPTIONS)[number])
      ? linhasFiltro.filter((x) => x !== opt)
      : [...linhasFiltro, opt]
    set('linha', formatLinha(next))
  }

  const raioValue = Math.min(filters.raioKm, raioMax)

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
            Raio <strong>{raioValue} km</strong>
          </span>
          <input
            type="range"
            min={0}
            max={raioMax}
            step={10}
            value={raioValue}
            onChange={(e) => set('raioKm', Number(e.target.value))}
            aria-valuemin={0}
            aria-valuemax={raioMax}
            aria-valuenow={raioValue}
            aria-label="Raio máximo em quilômetros a partir de Araçatuba"
          />
          <div className="raio-scale" aria-hidden>
            <span>0</span>
            <span>{mid}</span>
            <span>{raioMax}</span>
          </div>
        </label>

        <fieldset className="field field-linha">
          <legend>Linha</legend>
          <div className="linha-checks">
            {LINHA_OPTIONS.map((l) => (
              <label key={l} className="linha-check">
                <input
                  type="checkbox"
                  checked={linhasFiltro.includes(l)}
                  onChange={() => toggleLinhaFiltro(l)}
                />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </fieldset>

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

        <label className="field">
          <span>Indicação</span>
          <select value={filters.indicacao} onChange={(e) => set('indicacao', e.target.value)}>
            <option value="">Todas</option>
            {temSemIndicacao ? (
              <option value="__vazio__">Sem indicação</option>
            ) : null}
            {indicacoes.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filters-actions">
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            onClear()
          }}
        >
          Limpar filtros
        </button>
      </div>
    </section>
  )
}
