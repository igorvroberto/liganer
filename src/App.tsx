import { useEffect, useMemo, useState } from 'react'
import { calculateRow, createEmptyRow, numericValue } from './lib/calc'
import { exportComparisonPdf } from './lib/export'
import {
  formatDecimalInput,
  formatNullableCurrency,
  formatNullableNumber,
  formatNullablePercent,
} from './lib/format'
import {
  defaultSession,
  findSavedComparison,
  loadDraft,
  localPrintNumber,
  pushSavedComparison,
  removeSavedComparison,
  saveDraft,
  savedComparisonsAsListItems,
  upsertSavedComparison,
} from './lib/storage'
import type {
  CompareRowInput,
  CompareSession,
  SavedComparison,
  SavedComparisonListItem,
} from './lib/types'

type EditableKey = keyof Pick<
  CompareRowInput,
  | 'qty'
  | 'unit'
  | 'ourProduct'
  | 'ourIcms'
  | 'factorUsed'
  | 'competitor'
  | 'clientProduct'
  | 'clientPrice'
  | 'clientIcms'
  | 'priceFactor100'
>

const NUMBER_KEYS = new Set<EditableKey>([
  'qty',
  'ourIcms',
  'factorUsed',
  'clientPrice',
  'clientIcms',
  'priceFactor100',
])

const PERCENT_KEYS = new Set<EditableKey>(['ourIcms', 'clientIcms'])

/** Campos com vírgula decimal na UI (pt-BR). */
const DECIMAL_COMMA_KEYS = new Set<EditableKey>(['clientPrice', 'priceFactor100'])

function parseCellValue(key: EditableKey, raw: string): string | number | '' {
  if (!NUMBER_KEYS.has(key)) return raw
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === ',' || trimmed === '-' || trimmed === '-,') return ''
  const n = numericValue(trimmed)
  if (PERCENT_KEYS.has(key) && n > 1) return n / 100
  return n
}

function displayStoredValue(key: EditableKey, value: string | number | ''): string {
  if (value === '' || value == null) return ''
  if (PERCENT_KEYS.has(key) && typeof value === 'number') {
    return String(Number((value * 100).toFixed(4))).replace('.', ',')
  }
  if (DECIMAL_COMMA_KEYS.has(key) && typeof value === 'number') {
    return formatDecimalInput(value)
  }
  if (typeof value === 'number') {
    return String(value).replace('.', ',')
  }
  return String(value)
}

function DiffBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="calculated-cell">—</span>
  const cls =
    value > 0.0005 ? 'diff-positive' : value < -0.0005 ? 'diff-negative' : 'diff-zero'
  return <span className={`calculated-cell ${cls}`}>{formatNullablePercent(value)}</span>
}

type EditingMeta = {
  id: string
  number: string
  createdAt: string
}

export default function App() {
  const [session, setSession] = useState<CompareSession>(() => loadDraft() ?? defaultSession())
  const [savedList, setSavedList] = useState<SavedComparisonListItem[]>(() =>
    savedComparisonsAsListItems(),
  )
  const [editing, setEditing] = useState<EditingMeta | null>(null)
  const [draftInputs, setDraftInputs] = useState<Record<string, string>>({})
  const [pisDraft, setPisDraft] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error' | ''; text: string }>({
    kind: '',
    text: '',
  })

  useEffect(() => {
    saveDraft({ ...session, updatedAt: new Date().toISOString() })
  }, [session])

  const computedRows = useMemo(
    () =>
      session.rows.map((row) => ({
        row,
        calc: calculateRow(row, session.pisCofins),
      })),
    [session.rows, session.pisCofins],
  )

  const kpis = useMemo(() => {
    const withDiff = computedRows.filter((r) => r.calc.priceDiff != null)
    const avgDiff =
      withDiff.length === 0
        ? null
        : withDiff.reduce((sum, r) => sum + (r.calc.priceDiff ?? 0), 0) / withDiff.length
    const above = withDiff.filter((r) => (r.calc.priceDiff ?? 0) > 0).length
    const below = withDiff.filter((r) => (r.calc.priceDiff ?? 0) < 0).length
    return { avgDiff, above, below }
  }, [computedRows])

  function refreshSavedList() {
    setSavedList(savedComparisonsAsListItems())
  }

  function updateMeta<K extends keyof CompareSession>(key: K, value: CompareSession[K]) {
    setSession((prev) => ({ ...prev, [key]: value }))
  }

  function draftKey(rowId: string, key: EditableKey): string {
    return `${rowId}:${key}`
  }

  function inputDisplay(row: CompareRowInput, key: EditableKey): string {
    const dk = draftKey(row.id, key)
    if (Object.prototype.hasOwnProperty.call(draftInputs, dk)) return draftInputs[dk]
    return displayStoredValue(key, row[key] as string | number | '')
  }

  function updateRow(id: string, key: EditableKey, raw: string) {
    const dk = draftKey(id, key)
    if (NUMBER_KEYS.has(key)) {
      setDraftInputs((prev) => ({ ...prev, [dk]: raw }))
      const trimmed = raw.trim()
      if (trimmed === '' || /[.,]$/.test(trimmed)) {
        if (trimmed === '') {
          setSession((prev) => ({
            ...prev,
            rows: prev.rows.map((row) => (row.id === id ? { ...row, [key]: '' } : row)),
          }))
        }
        return
      }
    }

    const parsed = parseCellValue(key, raw)
    setSession((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.id === id ? { ...row, [key]: parsed } : row)),
    }))
  }

  function commitRowInput(id: string, key: EditableKey) {
    const dk = draftKey(id, key)
    const raw = draftInputs[dk]
    if (raw == null) return
    const parsed = parseCellValue(key, raw)
    setSession((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.id === id ? { ...row, [key]: parsed } : row)),
    }))
    setDraftInputs((prev) => {
      const next = { ...prev }
      delete next[dk]
      return next
    })
  }

  function pisDisplay(): string {
    if (pisDraft != null) return pisDraft
    return formatDecimalInput(Number((session.pisCofins * 100).toFixed(4)))
  }

  function updatePis(raw: string) {
    setPisDraft(raw)
    const trimmed = raw.trim()
    if (trimmed === '' || /[.,]$/.test(trimmed)) return
    const n = numericValue(trimmed)
    updateMeta('pisCofins', n > 1 ? n / 100 : n)
  }

  function commitPis() {
    if (pisDraft == null) return
    const trimmed = pisDraft.trim()
    if (trimmed === '' || trimmed === ',' || trimmed === '-') {
      setPisDraft(null)
      return
    }
    const n = numericValue(trimmed)
    updateMeta('pisCofins', n > 1 ? n / 100 : n)
    setPisDraft(null)
  }

  function addRow() {
    setSession((prev) => ({
      ...prev,
      rows: [...prev.rows, createEmptyRow()],
    }))
    setStatus({ kind: 'ok', text: 'Linha adicionada.' })
  }

  function removeRow(id: string) {
    setSession((prev) => ({
      ...prev,
      rows: prev.rows.filter((row) => row.id !== id),
    }))
  }

  function handleSave() {
    if (!session.rows.length) {
      setStatus({ kind: 'error', text: 'Adicione ao menos um item antes de salvar.' })
      return
    }
    const nowIso = new Date().toISOString()
    const number = editing?.number || localPrintNumber()
    const record: SavedComparison = {
      id: editing?.id || `comparacao-${Date.now()}`,
      number,
      name: number,
      clientName: session.clientName,
      notes: session.notes,
      pisCofins: session.pisCofins,
      rows: session.rows,
      createdAt: editing?.createdAt || nowIso,
      savedAt: nowIso,
    }
    if (editing) upsertSavedComparison(record)
    else pushSavedComparison(record)
    setEditing(null)
    refreshSavedList()
    setStatus({
      kind: 'ok',
      text: editing ? `Comparação ${number} atualizada.` : `Comparação salva: ${number}.`,
    })
  }

  function openSavedPdf(item: SavedComparisonListItem) {
    const record = findSavedComparison(item.id) || findSavedComparison(item.number)
    if (!record?.rows?.length) {
      setStatus({ kind: 'error', text: 'Comparação sem itens para gerar o PDF.' })
      return
    }
    exportComparisonPdf(record.rows, record.pisCofins, {
      clientName: record.clientName,
      number: record.number,
    })
    setStatus({ kind: 'ok', text: `PDF da comparação ${record.number} aberto.` })
  }

  function editSaved(item: SavedComparisonListItem) {
    const record = findSavedComparison(item.id) || findSavedComparison(item.number)
    if (!record?.rows?.length) {
      setStatus({ kind: 'error', text: 'Comparação sem itens para editar.' })
      return
    }
    setEditing({ id: record.id, number: record.number, createdAt: record.createdAt })
    setDraftInputs({})
    setPisDraft(null)
    setSession({
      clientName: record.clientName,
      notes: record.notes,
      pisCofins: record.pisCofins,
      rows: record.rows.map((row) => ({ ...row, id: row.id || crypto.randomUUID() })),
      updatedAt: new Date().toISOString(),
    })
    setStatus({ kind: 'ok', text: `Editando comparação ${record.number}.` })
  }

  function deleteSaved(item: SavedComparisonListItem) {
    removeSavedComparison(item.id)
    if (editing && (editing.id === item.id || editing.number === item.number)) {
      setEditing(null)
    }
    refreshSavedList()
    setStatus({ kind: 'ok', text: `Comparação ${item.number} excluída.` })
  }

  function cancelEditing() {
    setEditing(null)
    setStatus({ kind: 'ok', text: 'Edição cancelada.' })
  }

  return (
    <div className="app-shell">
      <div className="brand-row">
        <img
          className="brand-mark"
          src={`${import.meta.env.BASE_URL}liganer_favicon.webp`}
          alt="Liganer"
        />
        <div>
          <p className="eyebrow">Vendas · Liganer</p>
          <h1>Comparador de preço</h1>
        </div>
      </div>

      <section className="card">
        <h2>Cliente e parâmetros</h2>
        <div className="meta-row">
          <label className="field">
            <span>Cliente</span>
            <input
              value={session.clientName}
              onChange={(e) => updateMeta('clientName', e.target.value)}
              placeholder="Nome do cliente"
            />
          </label>
          <label className="field">
            <span>PIS + COFINS</span>
            <input
              inputMode="decimal"
              value={pisDisplay()}
              onChange={(e) => updatePis(e.target.value)}
              onBlur={commitPis}
              aria-label="PIS + COFINS em percentual"
            />
          </label>
        </div>
      </section>

      <section className="card table-card">
        <div className="section-heading">
          <h2>Itens</h2>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={addRow}>
              + Item
            </button>
          </div>
        </div>

        {editing ? (
          <p className="editing-banner">
            Editando comparação <strong>{editing.number}</strong>. Clique em Salvar para
            atualizar.
          </p>
        ) : null}

        <div className="table-scroll">
          <table className="items-table">
            <thead>
              <tr>
                <th className="delete-column" />
                <th className="item-number-column">#</th>
                <th>Qde</th>
                <th>UM</th>
                <th>Nosso produto</th>
                <th>Nosso{'\n'}preço</th>
                <th>Nosso{'\n'}ICMS %</th>
                <th>Fator</th>
                <th>Concorrente</th>
                <th>Produto cliente</th>
                <th>Preço{'\n'}cliente</th>
                <th>ICMS{'\n'}cliente %</th>
                <th>Preço{'\n'}equivalente</th>
                <th>Diferença{'\n'}preço</th>
                <th>Preço{'\n'}alvo</th>
                <th>Fator-alvo</th>
                <th>Preço{'\n'}fator 100</th>
                <th>Origem</th>
                <th>Destino</th>
              </tr>
            </thead>
            <tbody>
              {computedRows.map(({ row, calc }, index) => (
                <tr key={row.id}>
                  <td className="delete-column">
                    <button
                      type="button"
                      className="trash-button"
                      onClick={() => removeRow(row.id)}
                      aria-label={`Remover linha ${index + 1}`}
                    >
                      ×
                    </button>
                  </td>
                  <td className="item-number-cell">{index + 1}</td>
                  <td>
                    <input
                      className="cell-control"
                      inputMode="decimal"
                      value={inputDisplay(row, 'qty')}
                      onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                      onBlur={() => commitRowInput(row.id, 'qty')}
                      aria-label={`Quantidade linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control"
                      value={row.unit}
                      onChange={(e) => updateRow(row.id, 'unit', e.target.value)}
                      aria-label={`Unidade linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control"
                      value={row.ourProduct}
                      onChange={(e) => updateRow(row.id, 'ourProduct', e.target.value)}
                      aria-label={`Nosso produto linha ${index + 1}`}
                    />
                  </td>
                  <td className="formula-cell">
                    <span className="calculated-cell">
                      {formatNullableCurrency(calc.ourPrice)}
                    </span>
                  </td>
                  <td>
                    <input
                      className="cell-control"
                      inputMode="decimal"
                      value={inputDisplay(row, 'ourIcms')}
                      onChange={(e) => updateRow(row.id, 'ourIcms', e.target.value)}
                      onBlur={() => commitRowInput(row.id, 'ourIcms')}
                      aria-label={`Nosso ICMS % linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control"
                      inputMode="decimal"
                      value={inputDisplay(row, 'factorUsed')}
                      onChange={(e) => updateRow(row.id, 'factorUsed', e.target.value)}
                      onBlur={() => commitRowInput(row.id, 'factorUsed')}
                      aria-label={`Fator linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control"
                      value={row.competitor}
                      onChange={(e) => updateRow(row.id, 'competitor', e.target.value)}
                      aria-label={`Concorrente linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control"
                      value={row.clientProduct}
                      onChange={(e) => updateRow(row.id, 'clientProduct', e.target.value)}
                      aria-label={`Produto cliente linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control"
                      inputMode="decimal"
                      value={inputDisplay(row, 'clientPrice')}
                      onChange={(e) => updateRow(row.id, 'clientPrice', e.target.value)}
                      onBlur={() => commitRowInput(row.id, 'clientPrice')}
                      aria-label={`Preço cliente linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control"
                      inputMode="decimal"
                      value={inputDisplay(row, 'clientIcms')}
                      onChange={(e) => updateRow(row.id, 'clientIcms', e.target.value)}
                      onBlur={() => commitRowInput(row.id, 'clientIcms')}
                      aria-label={`ICMS cliente % linha ${index + 1}`}
                    />
                  </td>
                  <td className="formula-cell">
                    <span className="calculated-cell">
                      {formatNullableCurrency(calc.equivalentPrice)}
                    </span>
                  </td>
                  <td className="formula-cell">
                    <DiffBadge value={calc.priceDiff} />
                  </td>
                  <td className="formula-cell">
                    <span className="calculated-cell">
                      {formatNullableCurrency(calc.targetPrice)}
                    </span>
                  </td>
                  <td className="formula-cell">
                    <span className="calculated-cell">
                      {formatNullableNumber(calc.targetFactor, 2)}
                    </span>
                  </td>
                  <td>
                    <input
                      className="cell-control"
                      inputMode="decimal"
                      value={inputDisplay(row, 'priceFactor100')}
                      onChange={(e) => updateRow(row.id, 'priceFactor100', e.target.value)}
                      onBlur={() => commitRowInput(row.id, 'priceFactor100')}
                      aria-label={`Preço fator 100 linha ${index + 1}`}
                    />
                  </td>
                  <td className="formula-cell">
                    <span className="calculated-cell">
                      {formatNullableNumber(calc.origin, 4)}
                    </span>
                  </td>
                  <td className="formula-cell">
                    <span className="calculated-cell">
                      {formatNullableNumber(calc.destination, 4)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="kpi-grid" style={{ marginTop: 14 }}>
          <div className="summary-item">
            <span>Diferença média</span>
            <strong>{formatNullablePercent(kpis.avgDiff)}</strong>
          </div>
          <div className="summary-item">
            <span>Acima / abaixo</span>
            <strong>
              {kpis.above} / {kpis.below}
            </strong>
          </div>
        </div>

        <div className="actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-dark" onClick={handleSave}>
            {editing ? `Atualizar ${editing.number}` : 'Salvar'}
          </button>
          {editing ? (
            <button type="button" className="btn btn-secondary" onClick={cancelEditing}>
              Cancelar edição
            </button>
          ) : null}
        </div>
      </section>

      <section className="card">
        <h2>Comparações salvas</h2>
        {savedList.length ? (
          <div className="table-scroll saved-budgets-scroll">
            <table className="saved-budgets-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cliente</th>
                  <th>Itens</th>
                  <th>Dia/horário</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {savedList.map((item) => {
                  const isEditing =
                    editing && (editing.id === item.id || editing.number === item.number)
                  return (
                    <tr key={item.id} className={isEditing ? 'is-editing' : undefined}>
                      <td>{item.name}</td>
                      <td>{item.clientName?.trim() || '—'}</td>
                      <td>{item.itemCount}</td>
                      <td>
                        {item.savedAt
                          ? new Date(item.savedAt).toLocaleString('pt-BR')
                          : '—'}
                      </td>
                      <td>
                        <div className="saved-budget-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => openSavedPdf(item)}
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => editSaved(item)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-compact"
                            onClick={() => deleteSaved(item)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted-note">Nenhuma comparação salva ainda. Use Salvar.</p>
        )}
      </section>

      <p className={`status ${status.kind}`}>{status.text}</p>
    </div>
  )
}
