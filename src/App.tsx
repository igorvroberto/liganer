import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { applyFatorRules, calculateRow, calculateSummary, materialHasImp, numericValue, resolveFatorUtilizado } from './lib/calc'
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
import { fetchVendasUser, vendasLoginUrl, type VendasUser } from './lib/vendasAuth'

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
  const [listStyle, setListStyle] = useState<CSSProperties | undefined>()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const text = value == null ? '' : String(value)
  const display = open ? query : text

  function syncListPosition() {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setListStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 280),
      bottom: window.innerHeight - rect.top + 2,
      top: 'auto',
    })
  }

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (!open) return
    syncListPosition()
    function onReposition() {
      syncListPosition()
    }
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open])

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
        <ul className="material-search-list" role="listbox" style={listStyle}>
          {suggestions.map((row) => (
            <li key={`${row.codigo}|${row.material}`}>
              <button type="button" role="option" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(row)}>
                {row.material}
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
  row,
  onChange,
}: {
  field: FieldDef
  value: string | number | boolean | undefined
  row: ItemRow
  onChange: (value: string | number | boolean) => void
}) {
  const lockFatorUtilizado = field.key === 'fator_utilizado' && !materialHasImp(row.material)
  if (isCalculatedForRow(field) || field.locked || lockFatorUtilizado) {
    const displayValue =
      field.key === 'fator_utilizado' && !materialHasImp(row.material)
        ? resolveFatorUtilizado(row)
        : value
    return <span className="calculated-cell">{displayFieldValue(displayValue, field)}</span>
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

  if (Array.isArray(field.options)) {
    const raw = value == null ? '' : String(value).trim()
    const normalizedValue =
      field.options.find((opt) => opt === raw) ||
      field.options.find((opt) => numericValue(opt) === numericValue(raw) && numericValue(raw) !== 0) ||
      raw
    return (
      <select
        className="cell-control"
        value={field.options.includes(normalizedValue) ? normalizedValue : ''}
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
    owner?: VendasUser | null
  } | null>(null)
  const [priceCatalogVersion, setPriceCatalogVersion] = useState(0)
  const [activeRowIndex, setActiveRowIndex] = useState(0)
  const [vendasUser, setVendasUser] = useState<VendasUser | null>(null)

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
    void fetchVendasUser().then(setVendasUser)
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
      nextRow = applyFatorRules(nextRow)
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
      owner: record.owner || item.owner || null,
    })
    setActiveRowIndex(0)
    setStatus({ text: `Editando orçamento ${number}.`, kind: 'ok' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  async function openSavedPdfCliente(item: BudgetListItem, kind: 'cliente18' | 'cliente4') {
    const record = await resolveSavedRecord(item)
    if (!record) return
    exportPdf(
      kind,
      getModel(record.modelId),
      record.client,
      record.rows,
      record.conditions,
      record.summary,
      { number: record.number || item.number || undefined },
    )
  }

  async function openSavedPdfLiganer(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record) return
    exportPdf(
      'liganer',
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

  async function handleSaveBudget() {
    if (!rows.length) {
      setStatus({ text: 'Adicione ao menos um item.', kind: 'error' })
      return
    }
    let user = vendasUser
    if (!user) {
      user = await fetchVendasUser()
      setVendasUser(user)
    }
    if (!user && config.syncSecret) {
      setStatus({
        text: 'Faça login em vendas.liganer.com.br para salvar na lista da equipe.',
        kind: 'error',
      })
      window.location.assign(vendasLoginUrl(`${import.meta.env.BASE_URL}`))
      return
    }
    const number = editingBudget?.number || localPrintNumber()
    const createdAt = editingBudget?.createdAt || new Date().toISOString()
    const owner = editingBudget?.owner?.email ? editingBudget.owner : user
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
      source: 'salvar',
      owner: owner || null,
    }
    upsertSavedBudget(record)
    if (config.syncSecret) {
      const remote = await saveBudgetRemote(record, config)
      if (!remote.ok) {
        setStatus({ text: remote.error || 'Falha ao sincronizar o orçamento.', kind: 'error' })
      }
    }
    await refreshSavedBudgetsList()
    setEditingBudget({ id: record.id, number, createdAt, owner: record.owner || null })
    setStatus({ text: `Orçamento ${number} salvo.`, kind: 'ok' })
  }

  return (
    <div className="app-shell">
      <div className="brand-row">
        <img src={`${import.meta.env.BASE_URL}liganer_favicon.webp`} alt="" width={40} height={40} />
        <div>
          <p className="eyebrow">Liganer</p>
          <h1>Orçamento ACE</h1>
        </div>
        <div className="session-chip">
          {vendasUser ? (
            <>
              <strong>{vendasUser.name}</strong>
              <span>{vendasUser.email}</span>
            </>
          ) : (
            <a className="btn btn-secondary btn-compact" href={vendasLoginUrl(`${import.meta.env.BASE_URL}`)}>
              Entrar
            </a>
          )}
        </div>
      </div>

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
                        : field.key === 'fator_utilizado' && !materialHasImp(row.material)
                          ? resolveFatorUtilizado(row)
                          : row[field.key]
                      const lockedCell =
                        isCalculatedForRow(field) ||
                        field.locked ||
                        (field.key === 'fator_utilizado' && !materialHasImp(row.material))
                      return (
                        <td
                          key={field.key}
                          className={[
                            field.type === 'boolean' ? 'boolean-column' : '',
                            lockedCell ? 'formula-cell' : '',
                            field.searchable || field.key === 'material' ? 'material-column' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <CellControl
                            field={field}
                            value={value}
                            row={row}
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
        <div className="summary-columns">
          <div className="summary-column">
            <h3>4%</h3>
            <div className="summary-item">
              <span>Subtotal 4%</span>
              <strong>{formatCurrency(summary.subtotalCe)}</strong>
            </div>
            <div className="summary-item">
              <span>IPI 4%</span>
              <strong>{formatCurrency(summary.ipiCe)}</strong>
            </div>
            <div className="summary-item summary-item-total">
              <span>Total 4%</span>
              <strong>{formatCurrency(summary.totalCe)}</strong>
            </div>
          </div>
          <div className="summary-column">
            <h3>18%</h3>
            <div className="summary-item">
              <span>Subtotal 18%</span>
              <strong>{formatCurrency(summary.subtotalSp)}</strong>
            </div>
            <div className="summary-item">
              <span>IPI 18%</span>
              <strong>{formatCurrency(summary.ipiSp)}</strong>
            </div>
            <div className="summary-item summary-item-total">
              <span>Total 18%</span>
              <strong>{formatCurrency(summary.totalSp)}</strong>
            </div>
          </div>
        </div>
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
          <button type="button" className="btn btn-dark" onClick={() => void handleSaveBudget()}>
            {editingBudget ? `Atualizar ${editingBudget.number}` : 'Salvar'}
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
            Editando orçamento <strong>{editingBudget.number}</strong>. Use <strong>Atualizar</strong> para
            gravar as alterações
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
                  <th>Dono</th>
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
                      <td>{item.owner?.name?.trim() || item.owner?.email?.trim() || '—'}</td>
                      <td>{when ? new Date(when).toLocaleString('pt-BR') : '—'}</td>
                      <td>
                        <div className="saved-budget-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void openSavedPdfCliente(item, 'cliente18')}
                          >
                            PDF 18%
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void openSavedPdfCliente(item, 'cliente4')}
                          >
                            PDF 4%
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            onClick={() => void openSavedPdfLiganer(item)}
                          >
                            PDF Liganer
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
          <p className="muted-note">Nenhum orçamento salvo ainda. Use Salvar abaixo de Condições.</p>
        )}
      </section>

      <p className={`status ${status.kind || ''}`}>{status.text}</p>
    </div>
  )
}
