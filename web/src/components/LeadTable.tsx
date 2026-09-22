import { useMemo, useState } from 'react'
import type { Lead } from '../types'
import { SITUACAO_OPTIONS, STATUS_OPTIONS } from '../types'
import { potClass, sortLeads, type SortDir, type SortKey } from '../lib/filterLeads'

type Props = {
  leads: Lead[]
  selectedId: string | null
  onSelect: (id: string) => void
  onPatch: (id: string, patch: Partial<Lead>) => void
  onAdd?: () => void
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'potencial', label: 'Potencial' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'linha', label: 'Linha' },
  { key: 'categoria', label: 'Cat.' },
  { key: 'produto_provavel', label: 'Produto' },
  { key: 'situacao', label: 'Situação' },
  { key: 'ultimo_contato', label: 'Último contato' },
  { key: 'status', label: 'Status' },
  { key: 'proximo_contato', label: 'Próximo contato' },
  { key: 'ultima_compra', label: 'Última compra' },
  { key: 'proxima_acao', label: 'Próxima ação' },
]

function toDateInputValue(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

export function LeadTable({ leads, selectedId, onSelect, onPatch, onAdd }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('potencial')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => sortLeads(leads, sortKey, sortDir), [leads, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(
        key === 'ultima_compra' || key === 'proximo_contato' || key === 'ultimo_contato'
          ? 'desc'
          : 'asc',
      )
    }
  }

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        {onAdd ? (
          <button type="button" className="btn btn-sm" onClick={onAdd}>
            Adicionar lead
          </button>
        ) : null}
        <span className="muted tiny">
          {leads.length
            ? `${leads.length} na visão · colunas ajustam ao conteúdo`
            : 'Nenhum lead com esses filtros'}
        </span>
      </div>
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
              </td>
              <td>
                <strong>{l.empresa}</strong>
              </td>
              <td className="mono-cell">{l.cnpj || '—'}</td>
              <td>
                {l.cidade || '—'}
                {l.distancia_km_aracatuba ? (
                  <div className="muted tiny">{l.distancia_km_aracatuba} km</div>
                ) : null}
              </td>
              <td className="linha-cell">{l.linha || '—'}</td>
              <td className="cat-cell">{l.categoria || '—'}</td>
              <td className="cell-text">{l.produto_provavel || '—'}</td>
              <td onClick={(e) => e.stopPropagation()}>
                <select
                  className="table-edit table-edit-situacao"
                  value={l.situacao || 'Qualificado'}
                  onChange={(e) => onPatch(l.id, { situacao: e.target.value })}
                  aria-label={`Situação de ${l.empresa}`}
                >
                  {[
                    ...SITUACAO_OPTIONS,
                    ...(SITUACAO_OPTIONS as readonly string[]).includes(l.situacao) || !l.situacao
                      ? []
                      : [l.situacao],
                  ].map((s) => (
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
                  value={toDateInputValue(l.ultimo_contato ?? '')}
                  onChange={(e) => onPatch(l.id, { ultimo_contato: e.target.value })}
                  aria-label={`Último contato de ${l.empresa}`}
                />
              </td>
              <td className="col-status" onClick={(e) => e.stopPropagation()}>
                <select
                  className="table-edit table-edit-status"
                  value={l.status || 'Sem retorno'}
                  onChange={(e) => onPatch(l.id, { status: e.target.value })}
                  aria-label={`Status de ${l.empresa}`}
                >
                  {[
                    ...STATUS_OPTIONS,
                    ...(STATUS_OPTIONS as readonly string[]).includes(l.status) || !l.status
                      ? []
                      : [l.status],
                  ].map((s) => (
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
                  value={toDateInputValue(l.proximo_contato ?? '')}
                  onChange={(e) => onPatch(l.id, { proximo_contato: e.target.value })}
                  aria-label={`Próximo contato de ${l.empresa}`}
                />
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
              <td className="cell-text">{l.proxima_acao || '—'}</td>
            </tr>
          ))}
        </tbody>
        {onAdd ? (
          <tfoot>
            <tr className="table-add-row">
              <td colSpan={COLUMNS.length}>
                <button type="button" className="btn ghost btn-sm table-add-btn" onClick={onAdd}>
                  + Adicionar linha
                </button>
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  )
}
