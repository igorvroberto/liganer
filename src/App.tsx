import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateRow, calculateSummary, numericValue } from './lib/calc'
import { exportExcel, exportPdf } from './lib/export'
import {
  displayFieldValue,
  emptyRowDefaults,
  formatCnpj,
  formatCurrency,
  formatNumber,
} from './lib/format'
import {
  fieldLabel,
  footerFields,
  getModel,
  itemFields,
  itemHeaderLabel,
} from './lib/models'
import {
  deleteBudgetRemote,
  fetchBudgetRemote,
  findSavedBudget,
  loadConfig,
  listBudgetsRemote,
  loadDraft,
  localPrintNumber,
  mergeBudgetLists,
  pushSavedBudget,
  removeSavedBudget,
  saveBudgetRemote,
  saveDraft,
  savedBudgetsAsListItems,
  upsertSavedBudget,
  type SyncConfig,
} from './lib/storage'
import {
  applyCatalogMaterial,
  loadPriceCatalogFromExcel,
  searchCatalogMaterials,
  type PriceCatalogRow,
} from './lib/priceCatalog'
import type { BudgetListItem, BudgetRecord, ClientInfo, Conditions, FieldDef, ItemRow } from './lib/types'

function isCalculatedForRow(field: FieldDef): boolean {
  return Boolean(field.calculated)
}

function MaterialSearchControl({
  value,
  onChange,
}: {
  value: string | number | boolean | undefined
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value == null ? '' : String(value))
  const rootRef = useRef<HTMLDivElement | null>(null)
  const text = value == null ? '' : String(value)
  const display = open ? query : text

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const suggestions = useMemo(
    () => searchCatalogMaterials(open ? query : text, 25),
    [open, query, text],
  )

  function pick(row: PriceCatalogRow) {
    onChange(row.material)
    setQuery(row.material)
    setOpen(false)
  }

  return (
    <div className="material-search" ref={rootRef}>
      <input
        className="cell-control"
        value={display}
        placeholder="Pesquisar material…"
        aria-label="Material"
        aria-autocomplete="list"
        aria-expanded={open}
        onFocus={() => {
          setQuery(text)
          setOpen(true)
        }}
        onChange={(e) => {
          const next = e.target.value
          setQuery(next)
          setOpen(true)
          onChange(next)
        }}
      />
      {open && suggestions.length ? (
        <ul className="material-search-list" role="listbox">
          {suggestions.map((row) => (
            <li key={`${row.codigo}|${row.material}`}>
              <button type="button" role="option" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(row)}>
                <span className="material-search-name">{row.material}</span>
                <span className="material-search-meta">
                  {row.um}
                  {row.preco
                    ? ` · ${row.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function CellControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string | number | boolean | undefined
  onChange: (value: string | number | boolean) => void
}) {
  if (isCalculatedForRow(field)) {
    return <span className="calculated-cell">{displayFieldValue(value, field)}</span>
  }

  if (field.searchable || field.key === 'material') {
    return <MaterialSearchControl value={value} onChange={(v) => onChange(v)} />
  }

  if (field.type === 'boolean') {
    return (
      <input
        className="cell-check"
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={fieldLabel(field.label)}
      />
    )
  }

  const locked = Boolean(field.locked)

  if (Array.isArray(field.options)) {
    const normalizedValue = value == null ? '' : String(value)
    return (
      <select
        className="cell-control"
        disabled={locked}
        value={normalizedValue}
        onChange={(e) => onChange(e.target.value)}
        aria-label={fieldLabel(field.label)}
      >
        <option value="">—</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }

  const showGroupedNumber =
    field.type === 'number' && field.useGrouping !== false && (field.fractionDigits ?? 2) === 0
  const groupedDisplay =
    showGroupedNumber && value !== '' && value != null
      ? formatNumber(numericValue(value), 0, true)
      : value == null
        ? ''
        : String(value)

  return (
    <input
      className="cell-control"
      disabled={locked}
      inputMode={
        field.type === 'number' || field.type === 'currency' || field.type === 'percent'
          ? 'decimal'
          : 'text'
      }
      value={groupedDisplay}
      onChange={(e) => {
        if (!showGroupedNumber) {
          onChange(e.target.value)
          return
        }
        const digits = e.target.value.replace(/\D/g, '')
        onChange(digits === '' ? '' : Number(digits))
      }}
      aria-label={fieldLabel(field.label)}
    />
  )
}

function ConditionField({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string | number | boolean | undefined
  onChange: (value: string | number | boolean) => void
}) {
  if (field.options?.length) {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Selecionar…</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <label className="field">
      <span>{field.label}</span>
      <input
        inputMode={
          field.type === 'number' || field.type === 'currency' || field.type === 'percent'
            ? 'decimal'
            : 'text'
        }
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export default function App() {
  const draft = useMemo(() => loadDraft(), [])
  const [modelId] = useState('chapas')
  const [client, setClient] = useState<ClientInfo>(draft?.client || { name: '', cnpj: '' })
  const [rowsByModel, setRowsByModel] = useState<Record<string, ItemRow[]>>({
    chapas:
      draft?.rowsByModel?.chapas?.length
        ? draft.rowsByModel.chapas
        : [emptyRowDefaults(itemFields(getModel('chapas')))],
  })
  const [draftsByModel, setDraftsByModel] = useState<Record<string, Conditions>>({
    chapas: draft?.draftsByModel?.chapas || {},
  })
  const [status, setStatus] = useState<{ text: string; kind?: 'ok' | 'error' }>({ text: '' })
  const [config, setConfig] = useState<SyncConfig>({})
  const [savedBudgets, setSavedBudgets] = useState<BudgetListItem[]>(() => savedBudgetsAsListItems())
  const [editingBudget, setEditingBudget] = useState<{
    id: string
    number: string
    createdAt?: string
  } | null>(null)
  const [priceCatalogVersion, setPriceCatalogVersion] = useState(0)
  const [activeRowIndex, setActiveRowIndex] = useState(0)

  const model = getModel(modelId)
  const fields = useMemo(() => itemFields(model), [model])
  const conditionsFields = footerFields(model)
  const rows = rowsByModel[modelId] || []
  const conditions = draftsByModel[modelId] || {}
  const summary = useMemo(() => {
    void priceCatalogVersion
    return calculateSummary(modelId, rows, conditions)
  }, [modelId, rows, conditions, priceCatalogVersion])

  const safeRowIndex = rows.length ? Math.min(Math.max(activeRowIndex, 0), rows.length - 1) : 0

  useEffect(() => {
    void loadConfig().then(setConfig)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function refreshSavedBudgets(nextConfig: SyncConfig) {
      const local = savedBudgetsAsListItems()
      if (!nextConfig.syncSecret) {
        if (!cancelled) setSavedBudgets(local)
        return
      }
      const remote = await listBudgetsRemote(nextConfig)
      if (cancelled) return
      if (remote.ok) setSavedBudgets(mergeBudgetLists(remote.items, local))
      else setSavedBudgets(local)
    }
    void refreshSavedBudgets(config)
    return () => {
      cancelled = true
    }
  }, [config])

  useEffect(() => {
    void loadPriceCatalogFromExcel().then((result) => {
      setPriceCatalogVersion((v) => v + 1)
      if (!result.ok) {
        console.warn('Catálogo de preços: usando fallback JSON.', result.error)
      }
    })
  }, [])

  useEffect(() => {
    saveDraft({ modelId, client, rowsByModel, draftsByModel })
  }, [modelId, client, rowsByModel, draftsByModel])

  useEffect(() => {
    if (!rowsByModel[modelId]?.length) {
      setRowsByModel((prev) => ({
        ...prev,
        [modelId]: [emptyRowDefaults(itemFields(getModel(modelId)))],
      }))
    }
  }, [modelId, rowsByModel])

  function updateRow(index: number, key: string, value: string | number | boolean) {
    setRowsByModel((prev) => {
      const list = [...(prev[modelId] || [])]
      const previous = list[index] || {}
      let nextRow: ItemRow = { ...previous, [key]: value }
      if (key === 'material') {
        nextRow = applyCatalogMaterial(nextRow, String(value).trim())
      }
      list[index] = nextRow
      return { ...prev, [modelId]: list }
    })
  }

  function updateCondition(key: string, value: string | number | boolean) {
    setDraftsByModel((prev) => ({
      ...prev,
      [modelId]: { ...(prev[modelId] || {}), [key]: value },
    }))
  }

  function addItem(selectNew = true) {
    setRowsByModel((prev) => {
      const next = [...(prev[modelId] || []), emptyRowDefaults(fields)]
      if (selectNew) setActiveRowIndex(next.length - 1)
      return { ...prev, [modelId]: next }
    })
  }

  function removeItem(index: number) {
    setRowsByModel((prev) => {
      const list = [...(prev[modelId] || [])]
      list.splice(index, 1)
      const next = list.length ? list : [emptyRowDefaults(fields)]
      setActiveRowIndex((current) => Math.min(current, next.length - 1))
      return { ...prev, [modelId]: next }
    })
  }

  async function refreshSavedBudgetsList(nextConfig: SyncConfig = config) {
    const local = savedBudgetsAsListItems()
    if (!nextConfig.syncSecret) {
      setSavedBudgets(local)
      return
    }
    const remote = await listBudgetsRemote(nextConfig)
    setSavedBudgets(remote.ok ? mergeBudgetLists(remote.items, local) : local)
  }

  async function resolveSavedRecord(item: BudgetListItem): Promise<BudgetRecord | null> {
    let record = findSavedBudget(item.id) || (item.number ? findSavedBudget(item.number) : null)
    if (!record && item.number && config.syncSecret) {
      const remote = await fetchBudgetRemote(item.number, config)
      if (remote.ok && remote.record) {
        record = remote.record
        upsertSavedBudget({
          ...remote.record,
          number: remote.record.number || item.number,
          name: remote.record.number || item.number,
        })
      } else {
        setStatus({
          text: remote.error || 'Não foi possível carregar este orçamento.',
          kind: 'error',
        })
        return null
      }
    }
    return record
  }

  function cancelEditingBudget() {
    setEditingBudget(null)
    setStatus({ text: 'Edição cancelada.', kind: 'ok' })
  }

  async function editSavedBudget(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record) return
    const number = record.number || item.number || item.name
    setClient(record.client)
    setRowsByModel((prev) => ({
      ...prev,
      [record.modelId]: record.rows.length
        ? record.rows
        : [emptyRowDefaults(itemFields(getModel(record.modelId)))],
    }))
    setDraftsByModel((prev) => ({ ...prev, [record.modelId]: record.conditions || {} }))
    setEditingBudget({
      id: record.id,
      number,
      createdAt: record.createdAt,
    })
    setActiveRowIndex(0)
    setStatus({ text: `Editando orçamento ${number}.`, kind: 'ok' })
  }

  async function deleteSavedBudget(item: BudgetListItem) {
    const number = item.number || item.name
    const ok = window.confirm(`Excluir o orçamento ${number}?`)
    if (!ok) return
    removeSavedBudget(item.id)
    if (item.number) removeSavedBudget(item.number)
    if (config.syncSecret && item.number) {
      const remote = await deleteBudgetRemote(item.number, config)
      if (!remote.ok) {
        setStatus({ text: remote.error || 'Falha ao excluir no servidor.', kind: 'error' })
      }
    }
    if (editingBudget && (editingBudget.id === item.id || editingBudget.number === item.number)) {
      setEditingBudget(null)
    }
    await refreshSavedBudgetsList()
    setStatus({ text: `Orçamento ${number} excluído.`, kind: 'ok' })
  }

  async function openSavedPdfCliente(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record) return
    exportPdf(
      'cliente',
      getModel(record.modelId),
      record.client,
      record.rows,
      record.conditions,
      record.summary,
      { number: record.number || item.number || undefined },
    )
  }

  async function exportSavedXlsx(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record) return
    exportExcel(getModel(record.modelId), record.client, record.rows, record.conditions, {
      number: record.number || item.number || undefined,
    })
  }

  async function handlePdfCliente() {
    if (!rows.length) {
      setStatus({ text: 'Adicione ao menos um item.', kind: 'error' })
      return
    }
    const number = editingBudget?.number || localPrintNumber()
    const createdAt = editingBudget?.createdAt || new Date().toISOString()
    const record: BudgetRecord = {
      id: editingBudget?.id || number,
      createdAt,
      savedAt: new Date().toISOString(),
      modelId,
      modelName: model.name,
      client,
      rows,
      conditions,
      summary,
      number,
      name: number,
      source: 'pdf-cliente',
    }
    upsertSavedBudget(record)
    pushSavedBudget(record)
    if (config.syncSecret) {
      const remote = await saveBudgetRemote(record, config)
      if (!remote.ok) {
        setStatus({ text: remote.error || 'Falha ao sincronizar o orçamento.', kind: 'error' })
      }
    }
    exportPdf('cliente', model, client, rows, conditions, summary, { number })
    await refreshSavedBudgetsList()
    setEditingBudget({ id: record.id, number, createdAt })
    setStatus({ text: `PDF cliente ${number} gerado.`, kind: 'ok' })
  }

  return (
    <div className="app-shell">
      <div className="brand-row">
        <img src={`${import.meta.env.BASE_URL}liganer_favicon.webp`} alt="" width={40} height={40} />
        <div>
          <p className="eyebrow">Liganer</p>
          <h1>Orçamento ACE</h1>
        </div>
      </div>
      <p className="lede">Pesquise o material na tabela e complete fator, comissão e condições.</p>

      {model.status === 'pending' && (
        <div className="notice">
          O modelo <strong>{model.name}</strong> ainda está pendente (campos placeholder).
        </div>
      )}

      <section className="card toolbar-card">
        <div className="grid-2">
          <label className="field">
            <span>Nome do cliente</span>
            <input
              value={client.name}
              onChange={(e) => setClient((c) => ({ ...c, name: e.target.value }))}
              autoComplete="organization"
            />
          </label>
          <label className="field">
            <span>CNPJ</span>
            <input
              value={client.cnpj}
              inputMode="numeric"
              onChange={(e) => setClient((c) => ({ ...c, cnpj: formatCnpj(e.target.value) }))}
            />
          </label>
        </div>
      </section>

      <section className="card table-card">
        <div className="section-heading">
          <h2>Itens</h2>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => addItem(true)}>
              + Adicionar item
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="items-table">
            <thead>
              <tr>
                <th className="delete-column" aria-label="Ações" />
                <th className="item-number-column">Item</th>
                {fields.map((field) => (
                  <th
                    key={field.key}
                    className={[
                      field.type === 'boolean' ? 'boolean-column' : '',
                      field.searchable || field.key === 'material' ? 'material-column' : '',
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined}
                  >
                    {itemHeaderLabel(field.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const calc = calculateRow(modelId, row, conditions)
                const isActive = index === safeRowIndex
                return (
                  <tr
                    key={index}
                    className={isActive ? 'editing-row' : undefined}
                    onClick={() => setActiveRowIndex(index)}
                  >
                    <td className="delete-column">
                      <button
                        type="button"
                        className="trash-button"
                        aria-label={`Remover item ${index + 1}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeItem(index)
                        }}
                      >
                        ×
                      </button>
                    </td>
                    <td className="item-number-cell">{index + 1}</td>
                    {fields.map((field) => {
                      const value = isCalculatedForRow(field)
                        ? field.calc
                          ? calc[field.calc]
                          : row[field.key]
                        : row[field.key]
                      return (
                        <td
                          key={field.key}
                          className={[
                            field.type === 'boolean' ? 'boolean-column' : '',
                            isCalculatedForRow(field) ? 'formula-cell' : '',
                            field.searchable || field.key === 'material' ? 'material-column' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <CellControl
                            field={field}
                            value={value}
                            onChange={(v) => {
                              setActiveRowIndex(index)
                              updateRow(index, field.key, v)
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Totais</h2>
        <div className="summary-grid">
          <div className="summary-item">
            <span>Subtotal</span>
            <strong>{formatCurrency(summary.subtotal)}</strong>
          </div>
          <div className="summary-item">
            <span>IPI 3,25%</span>
            <strong>{formatCurrency(summary.ipi)}</strong>
          </div>
          <div className="summary-item">
            <span>Total</span>
            <strong>{formatCurrency(summary.total)}</strong>
          </div>
        </div>
        <p className="muted-note">
          Subtotal por peso/quantidade aguarda orientação da planilha <code>precos-ace.xlsx</code>.
        </p>
      </section>

      <section className="card">
        <h2>Condições</h2>
        <div className="grid-2">
          {conditionsFields.map((field) => (
            <ConditionField
              key={field.key}
              field={field}
              value={conditions[field.key]}
              onChange={(v) => updateCondition(field.key, v)}
            />
          ))}
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-dark" onClick={() => void handlePdfCliente()}>
            {editingBudget ? `Atualizar PDF ${editingBudget.number}` : 'PDF cliente'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => exportPdf('liganer', model, client, rows, conditions, summary)}
          >
            PDF Liganer
          </button>
          {editingBudget ? (
            <button type="button" className="btn btn-secondary" onClick={cancelEditingBudget}>
              Cancelar edição
            </button>
          ) : null}
        </div>
      </section>

      <section className="card">
        <h2>Orçamentos salvos</h2>
        {editingBudget ? (
          <p className="editing-banner">
            Editando orçamento <strong>{editingBudget.number}</strong>. Ao gerar o PDF cliente, este
            número será atualizado.
          </p>
        ) : null}
        {savedBudgets.length ? (
          <div className="table-scroll saved-budgets-scroll">
            <table className="saved-budgets-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>CNPJ</th>
                  <th>Dia/horário</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {savedBudgets.map((item) => {
                  const when = item.savedAt || item.createdAt
                  const isEditing =
                    editingBudget &&
                    (editingBudget.id === item.id || editingBudget.number === item.number)
                  return (
                    <tr key={item.id} className={isEditing ? 'is-editing' : undefined}>
                      <td>{item.number || item.name}</td>
                      <td>{item.client.name?.trim() || '—'}</td>
                      <td>{item.client.cnpj?.trim() || '—'}</td>
                      <td>{when ? new Date(when).toLocaleString('pt-BR') : '—'}</td>
                      <td>
                        <div className="saved-budget-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void openSavedPdfCliente(item)}
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void exportSavedXlsx(item)}
                          >
                            XLSX
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void editSavedBudget(item)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-compact"
                            onClick={() => void deleteSavedBudget(item)}
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
          <p className="muted-note">Nenhum orçamento salvo ainda. Use PDF cliente.</p>
        )}
      </section>

      <p className={`status ${status.kind || ''}`}>{status.text}</p>
    </div>
  )
}
