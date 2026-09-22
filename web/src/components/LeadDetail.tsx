import type { Lead } from '../types'
import { EDITABLE_FIELDS, LINHA_OPTIONS } from '../types'
import { formatLinha, parseLinha } from '../lib/linha'

type Props = {
  lead: Lead | null
  onClose: () => void
  onPatch: (id: string, patch: Partial<Lead>) => void
}

function toDateInputValue(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

export function LeadDetail({ lead, onClose, onPatch }: Props) {
  if (!lead) return null

  const wa = lead.whatsapp?.replace(/\D/g, '')
  const linhas = parseLinha(lead.linha)

  const toggleLinha = (opt: string) => {
    const next = linhas.includes(opt as (typeof LINHA_OPTIONS)[number])
      ? linhas.filter((x) => x !== opt)
      : [...linhas, opt]
    onPatch(lead.id, { linha: formatLinha(next) })
  }

  return (
    <aside className="detail">
      <header className="detail-header">
        <div>
          <p className="eyebrow">
            {lead.id} · {lead.categoria}
            {lead.linha ? ` · ${lead.linha}` : ''}
          </p>
          <h2>{lead.empresa}</h2>
          <p className="muted">
            Edite aqui — salvamento automático. Para descartar um lead, use Situação =
            Desqualificado (não há remoção).
          </p>
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
      </div>

      <div className="detail-grid edit-grid">
        <fieldset className="detail-row edit-row linha-fieldset">
          <legend className="edit-label">Linha de produto</legend>
          <div className="linha-checks">
            {LINHA_OPTIONS.map((opt) => (
              <label key={opt} className="linha-check">
                <input
                  type="checkbox"
                  checked={linhas.includes(opt)}
                  onChange={() => toggleLinha(opt)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {EDITABLE_FIELDS.map((field) => {
          const raw = String(lead[field.key] ?? '')
          const value = field.kind === 'date' ? toDateInputValue(raw) : raw
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
                  {field.options &&
                  !(field.options as readonly string[]).includes(value) &&
                  value ? (
                    <option value={value}>{value}</option>
                  ) : null}
                </select>
              ) : field.kind === 'textarea' ? (
                <textarea
                  rows={3}
                  value={value}
                  onChange={(e) => onPatch(lead.id, { [field.key]: e.target.value })}
                />
              ) : field.kind === 'date' ? (
                <input
                  type="date"
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
