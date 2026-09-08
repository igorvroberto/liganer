import type { Lead } from '../types'
import { CATEGORIA_LABEL } from '../types'
import { potClass } from '../lib/filterLeads'

type Props = {
  leads: Lead[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function PotBadge({ value }: { value: string }) {
  return <span className={`badge ${potClass(value)}`}>{value || '—'}</span>
}

export function LeadTable({ leads, selectedId, onSelect }: Props) {
  if (!leads.length) {
    return <p className="empty">Nenhum lead com esses filtros.</p>
  }

  return (
    <div className="table-wrap">
      <table className="leads-table">
        <thead>
          <tr>
            <th>Pot.</th>
            <th>Empresa</th>
            <th>Cidade</th>
            <th>Cat.</th>
            <th>Produto</th>
            <th>Classificação</th>
            <th>Situação</th>
            <th>Próxima ação</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr
              key={l.id}
              className={selectedId === l.id ? 'selected' : undefined}
              onClick={() => onSelect(l.id)}
            >
              <td>
                <PotBadge value={l.potencial} />
                {/^sim/i.test(l.multiproduto) ? <span className="star" title="Multiproduto">★</span> : null}
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
              <td>
                <span className={`chip class-${l.classificacao_comercial}`}>{l.classificacao_comercial}</span>
              </td>
              <td>{l.situacao}</td>
              <td className="clamp">{l.proxima_acao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
