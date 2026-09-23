import { useEffect, useMemo, useState } from 'react'
import type { Lead } from '../types'
import { EDITABLE_FIELDS, LINHA_OPTIONS } from '../types'
import { formatLinha, parseLinha } from '../lib/linha'

type Props = {
  lead: Lead | null
  /** Lead acabou de ser criado e ainda não foi salvo. */
  isNew?: boolean
  onClose: (result: { discarded: boolean }) => void
  onSave: (lead: Lead) => void
  onDirtyChange?: (dirty: boolean) => void
}

function toDateInputValue(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

function cloneLead(lead: Lead): Lead {
  return { ...lead }
}

function leadsEqual(a: Lead, b: Lead): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Lead>
  for (const key of keys) {
    if (String(a[key] ?? '') !== String(b[key] ?? '')) return false
  }
  return true
}

export function LeadDetail({ lead, isNew = false, onClose, onSave, onDirtyChange }: Props) {
  const [draft, setDraft] = useState<Lead | null>(() => (lead ? cloneLead(lead) : null))
  const [baseline, setBaseline] = useState<Lead | null>(() => (lead ? cloneLead(lead) : null))

  useEffect(() => {
    if (!lead) {
      setDraft(null)
      setBaseline(null)
      return
    }
    const next = cloneLead(lead)
    setDraft(next)
    setBaseline(next)
  }, [lead?.id])

  const dirty = useMemo(() => {
    if (!draft || !baseline) return false
    return !leadsEqual(draft, baseline)
  }, [draft, baseline])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  if (!lead || !draft) return null

  const wa = draft.whatsapp?.replace(/\D/g, '')
  const linhas = parseLinha(draft.linha)

  const patchDraft = (patch: Partial<Lead>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const toggleLinha = (opt: string) => {
    const next = linhas.includes(opt as (typeof LINHA_OPTIONS)[number])
      ? linhas.filter((x) => x !== opt)
      : [...linhas, opt]
    patchDraft({ linha: formatLinha(next) })
  }

  const handleSave = () => {
    onSave(draft)
    setBaseline(cloneLead(draft))
  }

  const handleClose = () => {
    if (dirty || isNew) {
      const msg = isNew
        ? 'Descartar este lead novo sem salvar?'
        : 'Descartar alterações não salvas?'
      if (!confirm(msg)) return
      onClose({ discarded: true })
      return
    }
    onClose({ discarded: false })
  }

  return (
    <section className="detail detail-below" id="lead-detail" aria-label={`Detalhe de ${draft.empresa}`}>
      <header className="detail-header">
        <div>
          <p className="eyebrow">
            {draft.id} · {draft.categoria}
            {draft.linha ? ` · ${draft.linha}` : ''}
            {isNew ? ' · novo' : ''}
            {dirty ? ' · não salvo' : ''}
          </p>
          <h2>{draft.empresa || 'Novo lead'}</h2>
          <p className="muted">
            Edite abaixo e clique em <strong>Salvar</strong> para gravar. Fechar sem salvar descarta as
            alterações. Use × na tabela para remover um lead (com confirmação).
          </p>
        </div>
        <div className="detail-header-actions">
          <button type="button" className="btn" onClick={handleSave} disabled={!dirty && !isNew}>
            Salvar
          </button>
          <button type="button" className="btn ghost" onClick={handleClose} aria-label="Fechar">
            Fechar
          </button>
        </div>
      </header>

      <div className="detail-actions">
        {draft.telefone && draft.telefone !== 'Não identificado' ? (
          <a className="btn" href={`tel:${draft.telefone.replace(/[^\d+]/g, '')}`}>
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
        <div className="detail-row edit-row readonly-row">
          <span className="edit-label">Distância (km)</span>
          <p className="readonly-value">{draft.distancia_km_aracatuba || '—'} km de Araçatuba</p>
        </div>

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
          const raw = String(draft[field.key] ?? '')
          const value = field.kind === 'date' ? toDateInputValue(raw) : raw
          return (
            <label key={field.key} className="detail-row edit-row">
              <span className="edit-label">{field.label}</span>
              {field.kind === 'select' ? (
                <select
                  value={value}
                  onChange={(e) => patchDraft({ [field.key]: e.target.value })}
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
                  onChange={(e) => patchDraft({ [field.key]: e.target.value })}
                />
              ) : field.kind === 'date' ? (
                <input
                  type="date"
                  value={value}
                  onChange={(e) => patchDraft({ [field.key]: e.target.value })}
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => patchDraft({ [field.key]: e.target.value })}
                />
              )}
            </label>
          )
        })}
      </div>

      <footer className="detail-footer">
        <button type="button" className="btn" onClick={handleSave} disabled={!dirty && !isNew}>
          Salvar
        </button>
        <button type="button" className="btn ghost" onClick={handleClose}>
          Fechar
        </button>
      </footer>
    </section>
  )
}
