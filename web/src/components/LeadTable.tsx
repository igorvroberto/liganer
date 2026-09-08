import { useMemo, useState } from 'react'
import type { Lead } from '../types'
import { CATEGORIA_LABEL, POTENCIAL_OPTIONS, SITUACAO_OPTIONS } from '../types'
import { potClass, sortLeads, type SortDir, type SortKey } from '../lib/filterLeads'

type Props = {
  leads: Lead[]
  selectedId: string | null
  onSelect: (id: string) => void
  onPatch: (id: string, patch: Partial<Lead>) => void
  onDelete: (id: string) => void
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'potencial', label: 'Potencial' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'categoria', label: 'Cat.' },
  { key: 'produto_provavel', label: 'Produto' },
  { key: 'situacao', label: 'Situação' },
  { key: 'ultima_compra', label: 'Última compra' },
  { key: 'proxima_acao', label: 'Próxima ação' },
]

/** Converte dd/mm/yyyy → yyyy-mm-dd para input type=date */
function toDateInputValue(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

export function LeadTable({ leads, selectedId, onSelect, onPatch, onDelete }: Props) {
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((l) => (
            <tr
              key={l.id}
              className={selectedId === l.id ? 'selected' : undefined}
              onClick={() => onSelect(l.id)}
            >
              <td onClick={(e) => e.stopPropagation()}>
                <select
                  className={`table-edit ${potClass(l.potencial)}`}
                  value={l.potencial}
                  onChange={(e) => onPatch(l.id, { potencial: e.target.value })}
                  aria-label={`Potencial de ${l.empresa}`}
                >
                  {POTENCIAL_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
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
              <td onClick={(e) => e.stopPropagation()}>
                <select
                  className="table-edit"
                  value={l.situacao}
                  onChange={(e) => onPatch(l.id, { situacao: e.target.value })}
                  aria-label={`Situação de ${l.empresa}`}
                >
                  {[
                    ...SITUACAO_OPTIONS,
                    ...(SITUACAO_OPTIONS as readonly string[]).includes(l.situacao)
                      ? []
                      : [l.situacao],
                  ]
                    .filter(Boolean)
                    .map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                </select>
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <input
                  type="date"
                  className="table-edit-text"
                  value={toDateInputValue(l.ultima_compra ?? '')}
                  onChange={(e) => onPatch(l.id, { ultima_compra: e.target.value })}
                  aria-label={`Última compra de ${l.empresa}`}
                />
              </td>
              <td
                className="clamp editable-cell"
                onClick={(e) => e.stopPropagation()}
                title="Clique para editar"
              >
                <input
                  className="table-edit-text"
                  value={l.proxima_acao}
                  onChange={(e) => onPatch(l.id, { proxima_acao: e.target.value })}
                  aria-label={`Próxima ação de ${l.empresa}`}
                />
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn ghost btn-sm danger"
                  onClick={() => {
                    if (confirm(`Remover ${l.empresa}?`)) onDelete(l.id)
                  }}
                >
                  Remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
