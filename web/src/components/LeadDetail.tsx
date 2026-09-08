import type { Lead } from '../types'
import { CATEGORIA_LABEL, EDITABLE_FIELDS } from '../types'

type Props = {
  lead: Lead | null
  onClose: () => void
  onPatch: (id: string, patch: Partial<Lead>) => void
  onDelete: (id: string) => void
}

export function LeadDetail({ lead, onClose, onPatch, onDelete }: Props) {
  if (!lead) {
    return (
      <aside className="detail empty-detail">
        <p>Selecione um lead na tabela para editar o dossiê comercial.</p>
      </aside>
    )
  }

  const wa = lead.whatsapp?.replace(/\D/g, '')

  return (
    <aside className="detail">
      <header className="detail-header">
        <div>
          <p className="eyebrow">
            {lead.id} · {lead.categoria}/{lead.subcategoria} ·{' '}
            {CATEGORIA_LABEL[lead.categoria] ?? lead.categoria}
          </p>
          <h2>{lead.empresa}</h2>
          <p className="muted">Edite os campos abaixo — alterações ficam salvas neste navegador.</p>
        </div>
        <button type="button" className="btn ghost" onClick={onClose} aria-label="Fechar">
          Fechar
        </button>
      </header>

      <div className="detail-actions">
        {lead.telefone && lead.telefone !== 'Não identificado' ? (
          <a className="btn" href={`tel:${lead.telefone.replace(/[^\d+]/g, '')}`}>
            Ligar
          </a>
        ) : null}
        {wa ? (
          <a
            className="btn"
            href={`https://wa.me/55${wa.replace(/^55/, '')}`}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
        ) : null}
        <button
          type="button"
          className="btn ghost danger"
          onClick={() => {
            if (confirm(`Remover ${lead.empresa}?`)) onDelete(lead.id)
          }}
        >
          Remover lead
        </button>
      </div>

      <div className="detail-grid edit-grid">
        {EDITABLE_FIELDS.map((field) => {
          const value = String(lead[field.key] ?? '')
          return (
            <label key={field.key} className="detail-row edit-row">
              <span className="edit-label">{field.label}</span>
              {field.kind === 'select' ? (
                <select
                  value={value}
                  onChange={(e) => onPatch(lead.id, { [field.key]: e.target.value })}
                >
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  {field.options && !(field.options as readonly string[]).includes(value) && value ? (
                    <option value={value}>{value}</option>
                  ) : null}
                </select>
              ) : field.kind === 'textarea' ? (
                <textarea
                  rows={3}
                  value={value}
                  onChange={(e) => onPatch(lead.id, { [field.key]: e.target.value })}
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onPatch(lead.id, { [field.key]: e.target.value })}
                />
              )}
            </label>
          )
        })}
      </div>
    </aside>
  )
}
