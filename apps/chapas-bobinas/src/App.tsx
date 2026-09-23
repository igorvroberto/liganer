import { useEffect, useMemo, useState } from 'react'
import { calculateRow, calculateSummary, isBobinaMaterial, numericValue, sheetUnitWeight, usesManualUnitWeight } from './lib/calc'
import { exportExcel, exportPdf, exportSituacaoReportPdf } from './lib/export'
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
  withCatalogFieldOptions,
} from './lib/models'
import {
  deleteBudgetRemote,
  fetchBudgetRemote,
  findSavedBudget,
  loadConfig,
  listBudgetsRemote,
  loadDraft,
  mergeBudgetLists,
  pushSavedBudget,
  removeSavedBudget,
  saveBudgetRemote,
  saveDraft,
  savedBudgetsAsListItems,
  uploadLocalBudgetsMissingRemote,
  upsertSavedBudget,
  type SyncConfig,
  normalizeBudgetSituacao,
  compareBudgetListItemsDefault,
} from './lib/storage'
import {
  getCatalogSelectOptions,
  loadPriceCatalogFromExcel,
  pruneInvalidCatalogSelections,
} from './lib/priceCatalog'
import { fetchVendasUser, vendasLoginUrl, type VendasUser } from './lib/vendasAuth'
import type {
  BudgetListItem,
  BudgetRecord,
  BudgetSituacao,
  ClientInfo,
  Conditions,
  FieldDef,
  ItemRow,
} from './lib/types'

const SITUACAO_OPTIONS: {
  value: BudgetSituacao
  label: string
  symbol: string
}[] = [
  { value: 'perdido', label: 'Perdido', symbol: '✕' },
  { value: 'analise', label: 'Em análise', symbol: '!' },
  { value: 'ganho', label: 'Ganho', symbol: '✓' },
]

const SAVED_PAGE_SIZE = 10

const MONTH_OPTIONS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const

type SavedSortKey =
  | 'number'
  | 'client'
  | 'cnpj'
  | 'owner'
  | 'totalKg'
  | 'totalRs'
  | 'situacao'
  | 'when'

type SavedSortState = { key: SavedSortKey; dir: 'asc' | 'desc' }

const SITUACAO_SORT_ORDER: Record<BudgetSituacao, number> = {
  perdido: 0,
  analise: 1,
  ganho: 2,
}

const SAVED_SORT_HEADERS: { key: SavedSortKey; label: string }[] = [
  { key: 'number', label: 'Número' },
  { key: 'client', label: 'Cliente' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'owner', label: 'Dono' },
  { key: 'totalKg', label: 'Total (Kg)' },
  { key: 'totalRs', label: 'Total (R$)' },
  { key: 'situacao', label: 'Situação' },
  { key: 'when', label: 'Dia/horário' },
]

function compareSavedBudgetsForSort(
  a: BudgetListItem,
  b: BudgetListItem,
  key: SavedSortKey,
): number {
  const situacaoRank = (item: BudgetListItem) =>
    SITUACAO_SORT_ORDER[normalizeBudgetSituacao(item.situacao)]
  switch (key) {
    case 'number':
      return String(a.number ?? a.name ?? '').localeCompare(String(b.number ?? b.name ?? ''), 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      })
    case 'client':
      return String(a.client?.name ?? '').localeCompare(String(b.client?.name ?? ''), 'pt-BR', {
        sensitivity: 'base',
      })
    case 'cnpj':
      return String(a.client?.cnpj ?? '').localeCompare(String(b.client?.cnpj ?? ''), 'pt-BR')
    case 'owner':
      return String(a.owner?.name || a.owner?.email || '').localeCompare(
        String(b.owner?.name || b.owner?.email || ''),
        'pt-BR',
        { sensitivity: 'base' },
      )
    case 'totalKg':
      return (a.totalKg ?? -1) - (b.totalKg ?? -1)
    case 'totalRs':
      return (a.totalRs ?? -1) - (b.totalRs ?? -1)
    case 'situacao':
      return situacaoRank(a) - situacaoRank(b)
    case 'when':
      return String(a.savedAt || a.createdAt || '').localeCompare(
        String(b.savedAt || b.createdAt || ''),
      )
    default:
      return 0
  }
}

function isCalculatedForRow(field: FieldDef, modelId: string, row: ItemRow): boolean {
  if (field.calculated) return true
  if (field.weightByMaterial) return !usesManualUnitWeight(modelId, row)
  return false
}

function CellControl({
  field,
  value,
  modelId,
  row,
  onChange,
}: {
  field: FieldDef
  value: string | number | boolean | undefined
  modelId: string
  row: ItemRow
  onChange: (value: string | number | boolean) => void
}) {
  if (isCalculatedForRow(field, modelId, row)) {
    return <span className="calculated-cell">{displayFieldValue(value, field)}</span>
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

  const cascadeLocked =
    (field.key === 'acabamento' && !String(row.tipo ?? '').trim()) ||
    (field.key === 'espessura' &&
      (!String(row.tipo ?? '').trim() || !String(row.acabamento ?? '').trim())) ||
    (field.key === 'comprimento' && isBobinaMaterial(row))
  const locked = Boolean(field.locked || cascadeLocked)

  if (Array.isArray(field.options)) {
    const normalizedValue = value == null ? '' : String(value)
    const supportsCustom = Boolean(field.customOptionLabel)
    const hasPreset = field.options.includes(normalizedValue)
    const customSelected = supportsCustom && normalizedValue === field.customOptionLabel
    const usingCustom = supportsCustom && !customSelected && normalizedValue !== '' && !hasPreset

    if (supportsCustom) {
      return (
        <div className="cell-control-stack">
          <select
            className="cell-control"
            disabled={locked}
            value={usingCustom ? field.customOptionLabel : normalizedValue}
            onChange={(e) => {
              const next = e.target.value
              if (next === field.customOptionLabel) {
                onChange(field.customOptionLabel!)
                return
              }
              onChange(next)
            }}
            aria-label={fieldLabel(field.label)}
          >
            <option value="">—</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={field.customOptionLabel}>{field.customOptionLabel}</option>
          </select>
          {usingCustom || customSelected ? (
            <input
              className="cell-control"
              disabled={locked}
              inputMode="numeric"
              value={customSelected ? '' : normalizedValue}
              onChange={(e) => onChange(e.target.value)}
              aria-label={`${fieldLabel(field.label)} personalizada`}
              placeholder={field.customOptionLabel}
            />
          ) : null}
        </div>
      )
    }

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
    owner?: VendasUser | null
    situacao?: BudgetSituacao
  } | null>(null)
  const [priceCatalogVersion, setPriceCatalogVersion] = useState(0)
  const [activeRowIndex, setActiveRowIndex] = useState(0)
  const [teamSync, setTeamSync] = useState<'off' | 'ok' | 'error'>('off')
  const [teamSyncDetail, setTeamSyncDetail] = useState('')
  const [vendasUser, setVendasUser] = useState<VendasUser | null>(null)
  const [savedSort, setSavedSort] = useState<SavedSortState | null>(null)
  const [savedPage, setSavedPage] = useState(1)
  const now = useMemo(() => new Date(), [])
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1)
  const [reportYear, setReportYear] = useState(now.getFullYear())

  const model = getModel(modelId)
  const baseFields = useMemo(() => itemFields(model), [model])
  const fields = baseFields
  const conditionsFields = footerFields(model)
  const rows = rowsByModel[modelId] || []
  const conditions = draftsByModel[modelId] || {}
  const summary = useMemo(
    () => calculateSummary(modelId, rows, conditions),
    [modelId, rows, conditions, priceCatalogVersion],
  )

  const sortedSavedBudgets = useMemo(() => {
    const list = [...savedBudgets]
    if (!savedSort) {
      list.sort(compareBudgetListItemsDefault)
      return list
    }
    list.sort((a, b) => {
      const cmp = compareSavedBudgetsForSort(a, b, savedSort.key)
      return savedSort.dir === 'asc' ? cmp : -cmp
    })
    return list
  }, [savedBudgets, savedSort])

  const savedPageCount = Math.max(1, Math.ceil(sortedSavedBudgets.length / SAVED_PAGE_SIZE))
  const safeSavedPage = Math.min(savedPage, savedPageCount)
  const pagedSavedBudgets = useMemo(() => {
    const start = (safeSavedPage - 1) * SAVED_PAGE_SIZE
    return sortedSavedBudgets.slice(start, start + SAVED_PAGE_SIZE)
  }, [sortedSavedBudgets, safeSavedPage])

  const reportYears = useMemo(() => {
    const years = new Set<number>([now.getFullYear()])
    for (const item of savedBudgets) {
      const raw = item.createdAt || item.savedAt
      if (!raw) continue
      const year = new Date(raw).getFullYear()
      if (Number.isFinite(year)) years.add(year)
    }
    return [...years].sort((a, b) => b - a)
  }, [savedBudgets, now])

  useEffect(() => {
    setSavedPage(1)
  }, [savedSort, savedBudgets.length])

  useEffect(() => {
    if (savedPage > savedPageCount) setSavedPage(savedPageCount)
  }, [savedPage, savedPageCount])

  const safeRowIndex = rows.length ? Math.min(Math.max(activeRowIndex, 0), rows.length - 1) : 0

  function toggleSavedSort(key: SavedSortKey) {
    setSavedSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

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
        if (!cancelled) {
          setSavedBudgets(local)
          setTeamSync('off')
          setTeamSyncDetail('Salvos só neste navegador.')
        }
        return
      }
      const uploaded = await uploadLocalBudgetsMissingRemote(nextConfig)
      if (cancelled) return
      const remote = await listBudgetsRemote(nextConfig)
      if (cancelled) return
      if (remote.ok) {
        setSavedBudgets(mergeBudgetLists(remote.items, savedBudgetsAsListItems()))
        setTeamSync('ok')
        const extra =
          uploaded.uploaded > 0
            ? ` ${uploaded.uploaded} orçamento(s) deste navegador enviados ao servidor.`
            : ''
        setTeamSyncDetail(`Lista compartilhada da equipe.${extra}`)
      } else {
        setSavedBudgets(local)
        setTeamSync('error')
        setTeamSyncDetail(remote.error || uploaded.error || 'Não foi possível ler o servidor.')
      }
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
      if (key === 'material' && isBobinaMaterial({ material: value })) {
        // Ao mudar para bobina, sugere o peso calculado da chapa se ainda não houver peso manual.
        const suggested = sheetUnitWeight({ ...nextRow, material: 'CHAPA' })
        if (!numericValue(previous.peso_unitario) && suggested > 0) {
          nextRow.peso_unitario = Math.round(suggested)
        }
      }
      if (key === 'material') {
        nextRow.material = String(value).trim().toUpperCase()
      }
      if (key === 'peso_unitario' && value !== '' && value !== undefined) {
        nextRow.peso_unitario = Math.round(numericValue(value))
      }
      if (key === 'tipo' || key === 'acabamento') {
        nextRow = pruneInvalidCatalogSelections(nextRow)
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
      setTeamSync('off')
      setTeamSyncDetail('Salvos só neste navegador.')
      return
    }
    const remote = await listBudgetsRemote(nextConfig)
    if (remote.ok) {
      setSavedBudgets(mergeBudgetLists(remote.items, local))
      setTeamSync('ok')
      setTeamSyncDetail('Lista compartilhada da equipe.')
    } else {
      setSavedBudgets(local)
      setTeamSync('error')
      setTeamSyncDetail(remote.error || 'Não foi possível ler o servidor.')
    }
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
    if (!record) {
      setStatus({ text: 'Orçamento não encontrado neste navegador.', kind: 'error' })
      return null
    }
    return record
  }

  async function saveBudget(): Promise<string | null> {
    if (!rows.length) {
      setStatus({
        text: 'Adicione ao menos um item antes de salvar.',
        kind: 'error',
      })
      return null
    }
    let user = vendasUser
    if (!user) {
      user = await fetchVendasUser()
      setVendasUser(user)
    }
    if (!user) {
      setStatus({
        text: 'Faça login em vendas.liganer.com.br para salvar na lista da equipe.',
        kind: 'error',
      })
      window.location.assign(vendasLoginUrl(`${import.meta.env.BASE_URL}`))
      return null
    }
    const nowIso = new Date().toISOString()
    const editing = editingBudget
    const owner = editing?.owner?.email ? editing.owner : user
    const situacao = normalizeBudgetSituacao(editing?.situacao)
    const record = {
      id: editing?.id || `orcamento-${Date.now()}`,
      createdAt: editing?.createdAt || nowIso,
      savedAt: nowIso,
      modelId,
      modelName: model.name,
      client: { ...client },
      rows,
      conditions,
      summary,
      source: 'salvar' as const,
      situacao,
      // Número só na edição; criação deixa o servidor atribuir (evita sobrescrever).
      ...(editing?.number
        ? { number: editing.number, name: editing.number }
        : {}),
      owner,
    }
    let number = editing?.number || ''
    if (editing) upsertSavedBudget({ ...record, number: number || record.id, name: number || record.id })
    else pushSavedBudget({ ...record, number: number || record.id, name: number || record.id })

    const remote = await saveBudgetRemote(record, config)
    if (remote.ok && remote.number) {
      number = remote.number
      upsertSavedBudget({
        ...record,
        number,
        name: number,
        savedAt: new Date().toISOString(),
      })
      setStatus({
        text: editing
          ? `Orçamento ${number} atualizado no servidor.`
          : `Orçamento salvo na lista da equipe: ${number}.`,
        kind: 'ok',
      })
    } else {
      upsertSavedBudget(record)
      setStatus({
        text: `Salvo neste navegador${remote.error ? ` — ${remote.error}` : ''}.`.trim(),
        kind: config.syncSecret ? 'error' : 'ok',
      })
    }
    setEditingBudget(null)
    await refreshSavedBudgetsList()
    return number
  }

  async function handleSave() {
    await saveBudget()
  }

  async function openSavedPdfCliente(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record?.rows?.length) {
      if (record) setStatus({ text: 'Orçamento sem itens para gerar o PDF.', kind: 'error' })
      return
    }
    const key = record.number || item.number || item.name || item.id
    const savedModel = getModel(record.modelId || modelId)
    const savedConditions = record.conditions || {}
    const savedSummary =
      record.summary || calculateSummary(savedModel.id, record.rows, savedConditions)
    exportPdf(
      'cliente',
      savedModel,
      record.client || { name: '', cnpj: '' },
      record.rows,
      savedConditions,
      savedSummary,
      { number: key },
    )
    setStatus({
      text: `PDF cliente do orçamento ${key} aberto.`,
      kind: 'ok',
    })
  }

  async function openSavedPdfLiganer(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record?.rows?.length) {
      if (record) setStatus({ text: 'Orçamento sem itens para gerar o PDF.', kind: 'error' })
      return
    }
    const key = record.number || item.number || item.name || item.id
    const savedModel = getModel(record.modelId || modelId)
    const savedConditions = record.conditions || {}
    const savedSummary =
      record.summary || calculateSummary(savedModel.id, record.rows, savedConditions)
    exportPdf(
      'liganer',
      savedModel,
      record.client || { name: '', cnpj: '' },
      record.rows,
      savedConditions,
      savedSummary,
      { number: key },
    )
    setStatus({
      text: `PDF Liganer do orçamento ${key} aberto.`,
      kind: 'ok',
    })
  }

  async function exportSavedXlsx(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record?.rows?.length) {
      if (record) setStatus({ text: 'Orçamento sem itens para exportar XLSX.', kind: 'error' })
      return
    }
    const key = record.number || item.number || item.name || item.id
    const savedModel = getModel(record.modelId || modelId)
    exportExcel(
      savedModel,
      record.client || { name: '', cnpj: '' },
      record.rows,
      record.conditions || {},
      { number: key },
    )
    setStatus({
      text: `XLSX do orçamento ${key} baixado.`,
      kind: 'ok',
    })
  }

  async function editSavedBudget(item: BudgetListItem) {
    const record = await resolveSavedRecord(item)
    if (!record?.rows?.length) {
      if (record) setStatus({ text: 'Orçamento sem itens para editar.', kind: 'error' })
      return
    }
    const number = record.number || item.number || item.name || item.id
    const mid = record.modelId || modelId
    setClient({
      name: record.client?.name || '',
      cnpj: record.client?.cnpj || '',
    })
    setRowsByModel((prev) => ({
      ...prev,
      [mid]: record.rows.map((row) => ({ ...row })),
    }))
    setDraftsByModel((prev) => ({
      ...prev,
      [mid]: { ...(record.conditions || {}) },
    }))
    setActiveRowIndex(0)
    setEditingBudget({
      id: record.id,
      number,
      createdAt: record.createdAt,
      owner: record.owner || item.owner || null,
      situacao: normalizeBudgetSituacao(record.situacao ?? item.situacao),
    })
    setStatus({
      text: `Editando orçamento ${number}. Use Atualizar para gravar as alterações.`,
      kind: 'ok',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function updateBudgetSituacao(item: BudgetListItem, situacao: BudgetSituacao) {
    const current = normalizeBudgetSituacao(item.situacao)
    if (current === situacao) return

    const record = await resolveSavedRecord(item)
    if (!record) {
      setStatus({ text: 'Orçamento não encontrado para atualizar a situação.', kind: 'error' })
      return
    }

    const next: BudgetRecord = {
      ...record,
      situacao,
      // Mantém savedAt original: mudança de situação não reordena nem “atualiza” o horário da lista.
      savedAt: record.savedAt || record.createdAt || new Date().toISOString(),
    }
    upsertSavedBudget(next)

    if (editingBudget && (editingBudget.id === item.id || editingBudget.number === item.number)) {
      setEditingBudget({ ...editingBudget, situacao })
    }

    setSavedBudgets((prev) =>
      prev.map((row) =>
        row.id === item.id || (item.number && row.number === item.number)
          ? { ...row, situacao, totalKg: next.summary?.totalKg ?? row.totalKg, totalRs: next.summary?.total ?? row.totalRs }
          : row,
      ),
    )

    if (config.syncSecret) {
      const remote = await saveBudgetRemote(next, config)
      if (!remote.ok) {
        setStatus({
          text: `Situação atualizada neste navegador${remote.error ? ` — ${remote.error}` : ''}.`,
          kind: 'error',
        })
        await refreshSavedBudgetsList()
        return
      }
      if (remote.number) {
        upsertSavedBudget({ ...next, number: remote.number, name: remote.number })
      }
    }

    setStatus({
      text: `Situação do orçamento ${item.name} atualizada.`,
      kind: 'ok',
    })
    await refreshSavedBudgetsList()
  }

  function cancelEditingBudget() {
    setEditingBudget(null)
    setStatus({ text: 'Edição cancelada.', kind: 'ok' })
  }

  async function deleteSavedBudget(item: BudgetListItem) {
    const number = item.number || item.name || item.id
    const ok = window.confirm(`Excluir o orçamento ${number}?`)
    if (!ok) return

    removeSavedBudget(item.id)
    if (item.number) removeSavedBudget(item.number)
    if (item.name && item.name !== item.id) removeSavedBudget(item.name)

    if (item.number && config.syncSecret) {
      const remote = await deleteBudgetRemote(item.number, config)
      if (!remote.ok) {
        setStatus({
          text: `Removido neste navegador, mas falhou no servidor: ${remote.error || ''}`.trim(),
          kind: 'error',
        })
        await refreshSavedBudgetsList()
        return
      }
    }

    if (editingBudget && (editingBudget.id === item.id || editingBudget.number === item.number)) {
      setEditingBudget(null)
    }
    await refreshSavedBudgetsList()
    setStatus({ text: `Orçamento ${number} excluído.`, kind: 'ok' })
  }

  return (
    <div className="app-shell">
      <div className="brand-row">
        <img
          className="brand-mark"
          src={`${import.meta.env.BASE_URL}liganer_favicon.webp`}
          alt="Liganer"
          width={42}
          height={42}
        />
        <div>
          <p className="eyebrow">Liganer</p>
          <h1>Orçamento de chapas e bobinas</h1>
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
          O modelo <strong>{model.name}</strong> ainda está pendente (campos placeholder). Use Chapas,
          Bobinas, Slitters ou Blanks para cotação completa.
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
                    className={field.type === 'boolean' ? 'boolean-column' : undefined}
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
                const rowFields = withCatalogFieldOptions(
                  baseFields,
                  getCatalogSelectOptions({
                    tipo: row.tipo,
                    acabamento: row.acabamento,
                  }),
                )
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
                    {rowFields.map((field) => {
                      const value = isCalculatedForRow(field, modelId, row)
                        ? field.calc
                          ? calc[field.calc]
                          : row[field.key]
                        : row[field.key]
                      return (
                        <td
                          key={field.key}
                          className={[
                            field.type === 'boolean' ? 'boolean-column' : '',
                            isCalculatedForRow(field, modelId, row) ? 'formula-cell' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <CellControl
                            field={field}
                            value={value}
                            modelId={modelId}
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
        <div className="summary-grid">
          <div className="summary-item">
            <span>Total (Kg)</span>
            <strong>{formatNumber(summary.totalKg, 0)} Kg</strong>
          </div>
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
          <button type="button" className="btn btn-dark" onClick={() => void handleSave()}>
            {editingBudget ? 'Atualizar' : 'Salvar'}
          </button>
          {editingBudget ? (
            <button type="button" className="btn btn-secondary" onClick={cancelEditingBudget}>
              Cancelar edição
            </button>
          ) : null}
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <h2>Orçamentos salvos</h2>
          {config.syncSecret ? (
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => void refreshSavedBudgetsList().then(() => setStatus({ text: 'Lista atualizada.', kind: 'ok' }))}
            >
              Atualizar lista
            </button>
          ) : null}
        </div>
        <p
          className={`sync-note${teamSync === 'error' ? ' sync-note-error' : teamSync === 'ok' ? ' sync-note-ok' : ''}`}
        >
          {teamSyncDetail ||
            (config.syncSecret
              ? 'Sincronizando com o servidor…'
              : 'Salvos só neste navegador.')}
        </p>
        <div className="report-bar">
          <div className="report-fields">
            <label>
              Mês
              <select
                value={reportMonth}
                onChange={(e) => setReportMonth(Number(e.target.value))}
              >
                {MONTH_OPTIONS.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ano
              <select
                value={reportYear}
                onChange={(e) => setReportYear(Number(e.target.value))}
              >
                {reportYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            onClick={() => {
              exportSituacaoReportPdf(savedBudgets, reportMonth, reportYear)
              setStatus({
                text: `Relatório de situações ${MONTH_OPTIONS[reportMonth - 1]}/${reportYear} aberto.`,
                kind: 'ok',
              })
            }}
          >
            Relatório PDF
          </button>
        </div>
        {editingBudget ? (
          <p className="editing-banner">
            Editando orçamento <strong>{editingBudget.number}</strong>. Use{' '}
            <strong>Atualizar</strong> para gravar as alterações
          </p>
        ) : null}
        {savedBudgets.length ? (
          <>
            <div className="table-scroll saved-budgets-scroll">
              <table className="saved-budgets-table">
                <thead>
                  <tr>
                    {SAVED_SORT_HEADERS.map((header) => {
                      const active = savedSort?.key === header.key
                      const ariaSort = !active
                        ? 'none'
                        : savedSort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                      return (
                        <th key={header.key} aria-sort={ariaSort}>
                          <button
                            type="button"
                            className={`sort-header${active ? ' is-active' : ''}`}
                            onClick={() => toggleSavedSort(header.key)}
                          >
                            <span>{header.label}</span>
                            <span className="sort-marker" aria-hidden="true">
                              {active ? (savedSort.dir === 'asc' ? '↑' : '↓') : '↕'}
                            </span>
                          </button>
                        </th>
                      )
                    })}
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSavedBudgets.map((item) => {
                    const when = item.savedAt || item.createdAt
                    const isEditing =
                      editingBudget &&
                      (editingBudget.id === item.id || editingBudget.number === item.number)
                    const situacao = normalizeBudgetSituacao(item.situacao)
                    return (
                      <tr key={item.id} className={isEditing ? 'is-editing' : undefined}>
                        <td>{item.name}</td>
                        <td>{item.client.name?.trim() || '—'}</td>
                        <td>{item.client.cnpj?.trim() || '—'}</td>
                        <td>{item.owner?.name?.trim() || item.owner?.email?.trim() || '—'}</td>
                        <td>
                          {typeof item.totalKg === 'number'
                            ? `${formatNumber(item.totalKg, 0)} Kg`
                            : '—'}
                        </td>
                        <td>
                          {typeof item.totalRs === 'number' ? formatCurrency(item.totalRs) : '—'}
                        </td>
                        <td>
                          <div className="situacao-group" role="group" aria-label="Situação do orçamento">
                            {SITUACAO_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className={`situacao-btn situacao-${option.value}${
                                  situacao === option.value ? ' is-active' : ''
                                }`}
                                title={option.label}
                                aria-label={option.label}
                                aria-pressed={situacao === option.value}
                                onClick={() => void updateBudgetSituacao(item, option.value)}
                              >
                                <span aria-hidden="true">{option.symbol}</span>
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>{when ? new Date(when).toLocaleString('pt-BR') : '—'}</td>
                        <td>
                          <div className="saved-budget-actions">
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              onClick={() => void openSavedPdfCliente(item)}
                            >
                              PDF cliente
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
            {sortedSavedBudgets.length > SAVED_PAGE_SIZE ? (
              <div className="pager">
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  disabled={safeSavedPage <= 1}
                  onClick={() => setSavedPage((page) => Math.max(1, page - 1))}
                >
                  Anterior
                </button>
                <span>
                  Página {safeSavedPage} de {savedPageCount}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  disabled={safeSavedPage >= savedPageCount}
                  onClick={() => setSavedPage((page) => Math.min(savedPageCount, page + 1))}
                >
                  Próxima
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted-note">Nenhum orçamento salvo ainda. Use Salvar.</p>
        )}
      </section>

      <p className={`status ${status.kind || ''}`}>{status.text}</p>
    </div>
  )
}
