import { useEffect, useMemo, useState } from 'react'
import { calculateRow, createEmptyRow, numericValue } from './lib/calc'
import {
  downloadTextFile,
  exportComparisonCsv,
  exportComparisonExcel,
} from './lib/export'
import {
  formatNullableCurrency,
  formatNullableNumber,
  formatNullablePercent,
  formatPercent,
} from './lib/format'
import { clearDraft, defaultSession, loadDraft, saveDraft } from './lib/storage'
import type { CompareRowInput, CompareSession } from './lib/types'

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
  | 'reference'
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

function parseCellValue(key: EditableKey, raw: string): string | number | '' {
  if (!NUMBER_KEYS.has(key)) return raw
  const trimmed = raw.trim()
  if (trimmed === '') return ''
  const n = numericValue(trimmed)
  if (PERCENT_KEYS.has(key) && n > 1) return n / 100
  return n
}

function displayInputValue(key: EditableKey, value: string | number | ''): string {
  if (value === '' || value == null) return ''
  if (PERCENT_KEYS.has(key) && typeof value === 'number') {
    return String(Number((value * 100).toFixed(4)))
  }
  return String(value)
}

function DiffBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="calculated-cell">—</span>
  const cls =
    value > 0.0005 ? 'diff-positive' : value < -0.0005 ? 'diff-negative' : 'diff-zero'
  return <span className={`calculated-cell ${cls}`}>{formatNullablePercent(value)}</span>
}

export default function App() {
  const [session, setSession] = useState<CompareSession>(() => loadDraft() ?? defaultSession())
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
    return {
      items: session.rows.length,
      compared: withDiff.length,
      avgDiff,
      above,
      below,
    }
  }, [computedRows, session.rows.length])

  function updateMeta<K extends keyof CompareSession>(key: K, value: CompareSession[K]) {
    setSession((prev) => ({ ...prev, [key]: value }))
  }

  function updateRow(id: string, key: EditableKey, raw: string) {
    setSession((prev) => ({
      ...prev,
      rows: prev.rows.map((row) =>
        row.id === id ? { ...row, [key]: parseCellValue(key, raw) } : row,
      ),
    }))
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

  function resetSample() {
    clearDraft()
    setSession(defaultSession())
    setStatus({ kind: 'ok', text: 'Dados de exemplo da planilha recarregados.' })
  }

  function handleExportExcel() {
    try {
      exportComparisonExcel(session.rows, session.pisCofins, {
        clientName: session.clientName,
        notes: session.notes,
      })
      setStatus({ kind: 'ok', text: 'Excel exportado.' })
    } catch (error) {
      setStatus({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Falha ao exportar Excel.',
      })
    }
  }

  function handleExportCsv() {
    const csv = exportComparisonCsv(session.rows, session.pisCofins)
    downloadTextFile(
      `liganer-comparador-preco-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8',
    )
    setStatus({ kind: 'ok', text: 'CSV exportado.' })
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
      <p className="lede">
        Compare nosso preço com o do concorrente considerando ICMS, PIS/COFINS e fator —
        mesma lógica da planilha <em>Diferença preço e ICMS</em>.
      </p>

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
              value={String(Number((session.pisCofins * 100).toFixed(4)))}
              onChange={(e) => {
                const n = numericValue(e.target.value)
                updateMeta('pisCofins', n > 1 ? n / 100 : n)
              }}
              aria-label="PIS + COFINS em percentual"
            />
          </label>
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Observações</span>
          <textarea
            rows={2}
            value={session.notes}
            onChange={(e) => updateMeta('notes', e.target.value)}
            placeholder="Concorrente, praça, validade…"
          />
        </label>
      </section>

      <section className="card">
        <div className="kpi-grid">
          <div className="summary-item">
            <span>Itens</span>
            <strong>{kpis.items}</strong>
          </div>
          <div className="summary-item">
            <span>Com comparação</span>
            <strong>{kpis.compared}</strong>
          </div>
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
      </section>

      <section className="card table-card">
        <div className="section-heading">
          <h2>Itens</h2>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={addRow}>
              + Item
            </button>
            <button type="button" className="btn btn-secondary" onClick={resetSample}>
              Recarregar exemplo
            </button>
            <button type="button" className="btn btn-dark" onClick={handleExportExcel}>
              Excel
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExportCsv}>
              CSV
            </button>
          </div>
        </div>

        <div className="notice">
          Campos em destaque vermelho-claro são calculados: nosso preço = preço fator 100 ÷
          fator × 100; preço equivalente ajusta ICMS/PIS; diferença = equivalente ÷ preço
          cliente − 1; preço alvo e fator-alvo fecham a conta para empatar com o
          concorrente. PIS+COFINS atual: {formatPercent(session.pisCofins)}.
        </div>

        <div className="table-scroll">
          <table className="items-table">
            <thead>
              <tr>
                <th className="item-number-column">#</th>
                <th>Qde</th>
                <th>UM</th>
                <th>Nosso produto</th>
                <th>Nosso{'\n'}preço</th>
                <th>Nosso{'\n'}ICMS %</th>
                <th>Fator{'\n'}utilizado</th>
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
                <th>Referência</th>
                <th className="delete-column" />
              </tr>
            </thead>
            <tbody>
              {computedRows.map(({ row, calc }, index) => (
                <tr key={row.id}>
                  <td className="item-number-cell">{index + 1}</td>
                  <td>
                    <input
                      className="cell-control narrow-control"
                      inputMode="decimal"
                      value={displayInputValue('qty', row.qty)}
                      onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                      aria-label={`Quantidade linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control narrow-control"
                      value={row.unit}
                      onChange={(e) => updateRow(row.id, 'unit', e.target.value)}
                      aria-label={`Unidade linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control wide-control"
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
                      className="cell-control narrow-control"
                      inputMode="decimal"
                      value={displayInputValue('ourIcms', row.ourIcms)}
                      onChange={(e) => updateRow(row.id, 'ourIcms', e.target.value)}
                      aria-label={`Nosso ICMS % linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control narrow-control"
                      inputMode="decimal"
                      value={displayInputValue('factorUsed', row.factorUsed)}
                      onChange={(e) => updateRow(row.id, 'factorUsed', e.target.value)}
                      aria-label={`Fator utilizado linha ${index + 1}`}
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
                      className="cell-control wide-control"
                      value={row.clientProduct}
                      onChange={(e) => updateRow(row.id, 'clientProduct', e.target.value)}
                      aria-label={`Produto cliente linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control narrow-control"
                      inputMode="decimal"
                      value={displayInputValue('clientPrice', row.clientPrice)}
                      onChange={(e) => updateRow(row.id, 'clientPrice', e.target.value)}
                      aria-label={`Preço cliente linha ${index + 1}`}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-control narrow-control"
                      inputMode="decimal"
                      value={displayInputValue('clientIcms', row.clientIcms)}
                      onChange={(e) => updateRow(row.id, 'clientIcms', e.target.value)}
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
                      className="cell-control narrow-control"
                      inputMode="decimal"
                      value={displayInputValue('priceFactor100', row.priceFactor100)}
                      onChange={(e) => updateRow(row.id, 'priceFactor100', e.target.value)}
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
                  <td>
                    <input
                      className="cell-control narrow-control"
                      value={row.reference}
                      onChange={(e) => updateRow(row.id, 'reference', e.target.value)}
                      aria-label={`Referência linha ${index + 1}`}
                    />
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`status ${status.kind}`}>{status.text}</p>
      </section>
    </div>
  )
}
