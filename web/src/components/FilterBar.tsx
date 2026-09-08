import type { Filters, Lead } from '../types'
import { CATEGORIA_LABEL, POTENCIAL_OPTIONS, SITUACAO_OPTIONS } from '../types'
import { uniqueSorted } from '../lib/filterLeads'

type Props = {
  leads: Lead[]
  filters: Filters
  onChange: (next: Filters) => void
  onClear: () => void
}

export function FilterBar({ leads, filters, onChange, onClear }: Props) {
  const cidades = uniqueSorted(leads.map((l) => l.cidade))
  const categorias = uniqueSorted(leads.map((l) => l.categoria))
  const situacoes = [
    ...SITUACAO_OPTIONS,
    ...uniqueSorted(leads.map((l) => l.situacao)).filter(
      (s) => !(SITUACAO_OPTIONS as readonly string[]).includes(s),
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

        <label className="field">
          <span>Categoria</span>
          <select value={filters.categoria} onChange={(e) => set('categoria', e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c} — {CATEGORIA_LABEL[c] ?? c}
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
          <span>Multiproduto</span>
          <select
            value={filters.multiproduto}
            onChange={(e) => set('multiproduto', e.target.value)}
          >
            <option value="">Todos</option>
            <option value="Sim">Sim</option>
            <option value="Não">Não</option>
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
