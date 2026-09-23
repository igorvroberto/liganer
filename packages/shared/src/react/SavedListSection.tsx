import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  collectYearsFromItems,
  exportSituacaoReportPdf,
  formatCurrency,
  formatNumber,
  MONTH_OPTIONS,
  normalizeBudgetSituacao,
  ownerLabel,
  pageCount,
  SAVED_PAGE_SIZE,
  SAVED_SORT_HEADERS,
  SITUACAO_OPTIONS,
  slicePage,
  sortSavedListItems,
  type BudgetSituacao,
  type SavedListItem,
  type SavedSortKey,
  type SavedSortState,
} from '../index'

export type SavedListSectionProps = {
  title: string
  items: SavedListItem[]
  emptyNote: string
  entityLabel?: string
  reportSubtitle?: string
  logoUrl?: string
  showCnpj?: boolean
  loading?: boolean
  editingBanner?: ReactNode
  syncNote?: ReactNode
  headingExtra?: ReactNode
  onSituacaoChange: (item: SavedListItem, situacao: BudgetSituacao) => void
  renderActions: (item: SavedListItem) => ReactNode
  className?: string
  /** Classe do card/section (default: card). */
  sectionClassName?: string
}

function toggleSort(prev: SavedSortState | null, key: SavedSortKey): SavedSortState | null {
  if (!prev || prev.key !== key) return { key, dir: 'asc' }
  if (prev.dir === 'asc') return { key, dir: 'desc' }
  return null
}

export function SavedListSection({
  title,
  items,
  emptyNote,
  entityLabel = 'orçamento',
  reportSubtitle,
  logoUrl,
  showCnpj = true,
  loading = false,
  editingBanner,
  syncNote,
  headingExtra,
  onSituacaoChange,
  renderActions,
  className,
  sectionClassName = 'card',
}: SavedListSectionProps) {
  const [savedSort, setSavedSort] = useState<SavedSortState | null>(null)
  const [savedPage, setSavedPage] = useState(1)
  const now = useMemo(() => new Date(), [])
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1)
  const [reportYear, setReportYear] = useState(now.getFullYear())

  const headers = useMemo(
    () => (showCnpj ? SAVED_SORT_HEADERS : SAVED_SORT_HEADERS.filter((h) => h.key !== 'cnpj')),
    [showCnpj],
  )

  const sorted = useMemo(() => sortSavedListItems(items, savedSort), [items, savedSort])
  const savedPageCount = pageCount(sorted.length, SAVED_PAGE_SIZE)
  const safeSavedPage = Math.min(savedPage, savedPageCount)
  const paged = useMemo(
    () => slicePage(sorted, safeSavedPage, SAVED_PAGE_SIZE),
    [sorted, safeSavedPage],
  )
  const reportYears = useMemo(
    () => collectYearsFromItems(items, now.getFullYear()),
    [items, now],
  )

  useEffect(() => {
    setSavedPage(1)
  }, [savedSort, items.length])

  useEffect(() => {
    if (savedPage > savedPageCount) setSavedPage(savedPageCount)
  }, [savedPage, savedPageCount])

  return (
    <section className={[sectionClassName, className].filter(Boolean).join(' ')}>
      <div className="section-heading section-head">
        <h2>{title}</h2>
        {headingExtra}
      </div>
      {syncNote}
      {loading ? <p className="note muted-note">Carregando…</p> : null}
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
          onClick={() =>
            exportSituacaoReportPdf(items, {
              month: reportMonth,
              year: reportYear,
              logoUrl,
              entityLabel,
              subtitle: reportSubtitle,
            })
          }
        >
          Relatório PDF
        </button>
      </div>
      {editingBanner}
      {!loading && items.length === 0 ? <p className="muted-note note">{emptyNote}</p> : null}
      {items.length > 0 ? (
        <>
          <div className="table-scroll saved-budgets-scroll">
            <table className="saved-budgets-table">
              <thead>
                <tr>
                  {headers.map((header) => {
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
                          onClick={() => setSavedSort((prev) => toggleSort(prev, header.key))}
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
                {paged.map((item) => {
                  const when = item.savedAt || item.createdAt
                  const situacao = normalizeBudgetSituacao(item.situacao)
                  return (
                    <tr
                      key={item.id}
                      className={item.meta?.isEditing ? 'is-editing' : undefined}
                    >
                      <td>{item.name}</td>
                      <td>{item.clientName?.trim() || '—'}</td>
                      {showCnpj ? <td>{item.cnpj?.trim() || '—'}</td> : null}
                      <td>{ownerLabel(item.owner) || '—'}</td>
                      <td>
                        {typeof item.totalKg === 'number'
                          ? `${formatNumber(item.totalKg, 0)} Kg`
                          : '—'}
                      </td>
                      <td>
                        {typeof item.totalRs === 'number' ? formatCurrency(item.totalRs) : '—'}
                      </td>
                      <td>
                        <div
                          className="situacao-group"
                          role="group"
                          aria-label={`Situação do ${entityLabel}`}
                        >
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
                              onClick={() => onSituacaoChange(item, option.value)}
                            >
                              <span aria-hidden="true">{option.symbol}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>{when ? new Date(when).toLocaleString('pt-BR') : '—'}</td>
                      <td>
                        <div className="saved-budget-actions">{renderActions(item)}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > SAVED_PAGE_SIZE ? (
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
      ) : null}
    </section>
  )
}
