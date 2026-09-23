import { useMemo, useState } from 'react'
import type { Lead } from '../types'
import {
  CATEGORIA_OPTIONS,
  CRM_OPTIONS,
  LINHA_OPTIONS,
  POTENCIAL_OPTIONS,
  SITUACAO_OPTIONS,
  STATUS_OPTIONS,
} from '../types'
import { sortLeads, type SortDir, type SortKey } from '../lib/filterLeads'
import { formatLinha, parseLinha } from '../lib/linha'

type Props = {
  leads: Lead[]
  selectedId: string | null
  onSelect: (id: string) => void
  onPatch: (id: string, patch: Partial<Lead>) => void
  onAdd?: () => void
  onRemove?: (id: string) => void
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'potencial', label: 'Potencial' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'estado', label: 'UF' },
  { key: 'distancia_km_aracatuba', label: 'Distância' },
  { key: 'linha', label: 'Linha' },
  { key: 'categoria', label: 'Cat.' },
  { key: 'comprador', label: 'Comprador' },
  { key: 'crm', label: 'CRM' },
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'ultimo_contato', label: 'Último contato' },
  { key: 'status', label: 'Status' },
  { key: 'proximo_contato', label: 'Próximo contato' },
  { key: 'ultima_compra', label: 'Última compra' },
  { key: 'situacao', label: 'Situação' },
  { key: 'indicacao', label: 'Indicação' },
]

function toDateInputValue(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return ''
}

function TextCell({
  value,
  onChange,
  ariaLabel,
  className,
}: {
  value: string
  onChange: (v: string) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <td>
      <input
        type="text"
        className={`table-edit-text${className ? ` ${className}` : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
    </td>
  )
}

function SelectCell({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: string
  options: readonly string[]
  onChange: (v: string) => void
  ariaLabel: string
  className?: string
}) {
  const extra =
    value && !(options as readonly string[]).includes(value) ? [value] : ([] as string[])
  return (
    <td className={className}>
      <select
        className="table-edit"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      >
        {[...options, ...extra].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </td>
  )
}

export function LeadTable({ leads, selectedId, onSelect, onPatch, onAdd, onRemove }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('potencial')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => sortLeads(leads, sortKey, sortDir), [leads, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(
        key === 'ultima_compra' ||
          key === 'proximo_contato' ||
          key === 'ultimo_contato' ||
          key === 'distancia_km_aracatuba'
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
            ? `${leads.length} na visão · edite na tabela ou clique na linha para o painel`
            : 'Nenhum lead com esses filtros'}
        </span>
      </div>
      <table className="leads-table">
        <thead>
          <tr>
            {onRemove ? (
              <th className="col-remove">
                <span className="sr-only">Remover</span>
              </th>
            ) : null}
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
          {sorted.map((l) => {
            const linhas = parseLinha(l.linha)
            const toggleLinha = (opt: string) => {
              const next = linhas.includes(opt as (typeof LINHA_OPTIONS)[number])
                ? linhas.filter((x) => x !== opt)
                : [...linhas, opt]
              onPatch(l.id, { linha: formatLinha(next) })
            }
            return (
              <tr
                key={l.id}
                className={selectedId === l.id ? 'selected' : undefined}
                onClick={() => onSelect(l.id)}
                style={{ cursor: 'pointer' }}
              >
                {onRemove ? (
                  <td className="col-remove" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn-remove-row"
                      onClick={() => onRemove(l.id)}
                      aria-label={`Remover ${l.empresa}`}
                      title="Remover lead"
                    >
                      ×
                    </button>
                  </td>
                ) : null}
                <SelectCell
                  value={l.potencial || 'Médio'}
                  options={POTENCIAL_OPTIONS}
                  onChange={(v) => onPatch(l.id, { potencial: v })}
                  ariaLabel={`Potencial de ${l.empresa}`}
                />
                <TextCell
                  value={l.empresa ?? ''}
                  onChange={(v) => onPatch(l.id, { empresa: v })}
                  ariaLabel={`Empresa`}
                  className="table-edit-empresa"
                />
                <TextCell
                  value={l.cnpj ?? ''}
                  onChange={(v) => onPatch(l.id, { cnpj: v })}
                  ariaLabel={`CNPJ de ${l.empresa}`}
                  className="table-edit-cnpj"
                />
                <TextCell
                  value={l.cidade ?? ''}
                  onChange={(v) => onPatch(l.id, { cidade: v })}
                  ariaLabel={`Cidade de ${l.empresa}`}
                />
                <TextCell
                  value={l.estado ?? ''}
                  onChange={(v) => onPatch(l.id, { estado: v })}
                  ariaLabel={`UF de ${l.empresa}`}
                  className="table-edit-uf"
                />
                <td className="mono-cell cell-dist">
                  {l.distancia_km_aracatuba || '—'}
                </td>
                <td className="linha-cell">
                  <div className="linha-checks linha-checks-table">
                    {LINHA_OPTIONS.map((opt) => (
                      <label key={opt} className="linha-check">
                        <input
                          type="checkbox"
                          checked={linhas.includes(opt)}
                          onChange={() => toggleLinha(opt)}
                        />
                        <span>{opt === 'Ferro para construção' ? 'Ferro' : opt}</span>
                      </label>
                    ))}
                  </div>
                </td>
                <SelectCell
                  value={l.categoria || 'Metalúrgica'}
                  options={CATEGORIA_OPTIONS}
                  onChange={(v) => onPatch(l.id, { categoria: v })}
                  ariaLabel={`Categoria de ${l.empresa}`}
                  className="cat-cell"
                />
                <TextCell
                  value={l.comprador ?? ''}
                  onChange={(v) => onPatch(l.id, { comprador: v })}
                  ariaLabel={`Comprador de ${l.empresa}`}
                />
                <SelectCell
                  value={l.crm || 'Sem cadastro'}
                  options={CRM_OPTIONS}
                  onChange={(v) => onPatch(l.id, { crm: v })}
                  ariaLabel={`CRM de ${l.empresa}`}
                />
                <TextCell
                  value={l.vendedor ?? ''}
                  onChange={(v) => onPatch(l.id, { vendedor: v })}
                  ariaLabel={`Vendedor de ${l.empresa}`}
                />
                <td>
                  <input
                    type="date"
                    className="table-edit-text"
                    value={toDateInputValue(l.ultimo_contato ?? '')}
                    onChange={(e) => onPatch(l.id, { ultimo_contato: e.target.value })}
                    aria-label={`Último contato de ${l.empresa}`}
                  />
                </td>
                <SelectCell
                  value={l.status || 'Sem retorno'}
                  options={STATUS_OPTIONS}
                  onChange={(v) => onPatch(l.id, { status: v })}
                  ariaLabel={`Status de ${l.empresa}`}
                  className="col-status"
                />
                <td>
                  <input
                    type="date"
                    className="table-edit-text"
                    value={toDateInputValue(l.proximo_contato ?? '')}
                    onChange={(e) => onPatch(l.id, { proximo_contato: e.target.value })}
                    aria-label={`Próximo contato de ${l.empresa}`}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    className="table-edit-text"
                    value={toDateInputValue(l.ultima_compra ?? '')}
                    onChange={(e) => onPatch(l.id, { ultima_compra: e.target.value })}
                    aria-label={`Última compra de ${l.empresa}`}
                  />
                </td>
                <SelectCell
                  value={l.situacao || 'Qualificado'}
                  options={SITUACAO_OPTIONS}
                  onChange={(v) => onPatch(l.id, { situacao: v })}
                  ariaLabel={`Situação de ${l.empresa}`}
                />
                <TextCell
                  value={l.indicacao ?? ''}
                  onChange={(v) => onPatch(l.id, { indicacao: v })}
                  ariaLabel={`Indicação de ${l.empresa}`}
                />
              </tr>
            )
          })}
        </tbody>
        {onAdd ? (
          <tfoot>
            <tr className="table-add-row">
              <td colSpan={COLUMNS.length + (onRemove ? 1 : 0)}>
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
