import { useMemo, useState } from 'react'
import type { Lead } from '../types'
import { CATEGORIA_LABEL } from '../types'
import { potClass, sortLeads, type SortDir, type SortKey } from '../lib/filterLeads'

type Props = {
  leads: Lead[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'potencial', label: 'Potencial' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'categoria', label: 'Cat.' },
  { key: 'produto_provavel', label: 'Produto' },
  { key: 'situacao', label: 'Situação' },
  { key: 'ultima_compra', label: 'Última compra' },
  { key: 'proxima_acao', label: 'Próxima ação' },
]

function formatDateBr(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-')
    return `${d}/${m}/${y}`
  }
  return s
}

export function LeadTable({ leads, selectedId, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('potencial')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => sortLeads(leads, sortKey, sortDir), [leads, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'ultima_compra' ? 'desc' : 'asc')
    }
  }

  if (!leads.length) {
    return <p className="empty">Nenhum lead com esses filtros.</p>
  }

  return (
    <div className="table-wrap">
      <table className="leads-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = sortKey === col.key
              return (
                <th key={col.key}>
                  <button
                    type="button"
                    className={`th-sort${active ? ' active' : ''}`}
                    onClick={() => toggleSort(col.key)}
                    aria-label={`Ordenar por ${col.label}`}
                  >
                    {col.label}
                    <span className="th-sort-ind" aria-hidden>
                      {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((l) => (
            <tr
              key={l.id}
              className={selectedId === l.id ? 'selected' : undefined}
              onClick={() => onSelect(l.id)}
            >
              <td>
                <span className={`pot-pill ${potClass(l.potencial)}`}>{l.potencial}</span>
                {/^sim/i.test(l.multiproduto) ? (
                  <span className="star" title="Multiproduto">
                    ★
                  </span>
                ) : null}
              </td>
              <td>
                <strong>{l.empresa}</strong>
                <div className="muted tiny">{l.id}</div>
              </td>
              <td className="mono-cell">{l.cnpj || '—'}</td>
              <td>
                {l.cidade}
                {l.distancia_km_aracatuba ? (
                  <div className="muted tiny">{l.distancia_km_aracatuba} km</div>
                ) : null}
              </td>
              <td>
                {l.categoria}
                <div className="muted tiny">
                  {l.subcategoria} · {CATEGORIA_LABEL[l.categoria] ?? ''}
                </div>
              </td>
              <td className="clamp">{l.produto_provavel}</td>
              <td>{l.situacao}</td>
              <td>{formatDateBr(l.ultima_compra ?? '')}</td>
              <td className="clamp">{l.proxima_acao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
