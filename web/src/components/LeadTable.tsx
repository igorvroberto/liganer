import type { Lead } from '../types'
import { CATEGORIA_LABEL, POTENCIAL_OPTIONS, SITUACAO_OPTIONS } from '../types'
import { potClass } from '../lib/filterLeads'

type Props = {
  leads: Lead[]
  selectedId: string | null
  onSelect: (id: string) => void
  onPatch: (id: string, patch: Partial<Lead>) => void
  onDelete: (id: string) => void
}

export function LeadTable({ leads, selectedId, onSelect, onPatch, onDelete }: Props) {
  if (!leads.length) {
    return <p className="empty">Nenhum lead com esses filtros.</p>
  }

  return (
    <div className="table-wrap">
      <table className="leads-table">
        <thead>
          <tr>
            <th>Potencial</th>
            <th>Empresa</th>
            <th>Cidade</th>
            <th>Cat.</th>
            <th>Produto</th>
            <th>Situação</th>
            <th>Próxima ação</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
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
