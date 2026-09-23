import * as XLSX from 'xlsx'
import { calculateRow, usesManualUnitWeight } from './calc'
import { displayFieldValue, formatCurrency, formatNumber } from './format'
import {
  HIDDEN_FROM_CLIENT,
  fieldLabel,
  footerFields,
  isSupplierKey,
  itemFields,
} from './models'
import { localPrintNumber, normalizeBudgetSituacao } from './storage'
import type { BudgetListItem, BudgetSituacao, ClientInfo, Conditions, FieldDef, ItemRow, ModelDef, Summary } from './types'

function valueForField(
  field: FieldDef,
  modelId: string,
  row: ItemRow,
  conditions: Conditions,
  index: number,
): unknown {
  if (field.key === '_item') return index + 1
  const calc = calculateRow(modelId, row, conditions)
  if (field.weightByMaterial && field.calc && field.calc in calc) {
    return usesManualUnitWeight(modelId, row) ? row[field.key] : calc[field.calc]
  }
  if (field.calculated && field.calc && field.calc in calc) {
    return calc[field.calc]
  }
  return row[field.key]
}

function exportableFields(model: ModelDef, kind: 'cliente' | 'liganer'): FieldDef[] {
  const fields = itemFields(model).filter((f) => !f.hiddenInApp)
  if (kind === 'liganer') return fields
  const visible = fields.filter(
    (f) => !HIDDEN_FROM_CLIENT.has(f.key) && f.type !== 'boolean' && !isSupplierKey(f.key),
  )
  return orderClientePdfFields(visible)
}

/** PDF cliente: ICMS após peso total; preço sem IPI antes do subtotal. */
function orderClientePdfFields(fields: FieldDef[]): FieldDef[] {
  const byKey = new Map(fields.map((field) => [field.key, field]))
  const result: FieldDef[] = []
  for (const field of fields) {
    if (field.key === 'icms' || field.key === '_preco_sem_ipi') continue
    if (field.key === '_peso_total') {
      result.push(field)
      const icms = byKey.get('icms')
      if (icms) result.push(icms)
      continue
    }
    if (field.key === '_subtotal') {
      const precoSemIpi = byKey.get('_preco_sem_ipi')
      if (precoSemIpi) result.push(precoSemIpi)
      result.push(field)
      continue
    }
    result.push(field)
  }
  return result
}

export function exportExcel(
  model: ModelDef,
  client: ClientInfo,
  rows: ItemRow[],
  conditions: Conditions,
  options?: { number?: string },
): void {
  if (!rows.length) return
  const fields = exportableFields(model, 'liganer')
  const aoa: (string | number)[][] = [
    ['Cliente', 'CNPJ', ...fields.map((f) => fieldLabel(f.label))],
  ]
  rows.forEach((row, index) => {
    aoa.push([
      client.name,
      client.cnpj,
      ...fields.map((f) => {
        const v = valueForField(f, model.id, row, conditions, index)
        if (typeof v === 'boolean') return v ? 'X' : ''
        if (typeof v === 'number') return v
        return v == null ? '' : String(v)
      }),
    ])
  })
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Orcamento')
  const number = String(options?.number ?? '').trim()
  const filename = number ? `${number}.xlsx` : `orcamento-${model.id}.xlsx`
  XLSX.writeFile(book, filename)
}

function logoUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${window.location.origin}${base}liganer_favicon.webp`
}

export function exportPdf(
  kind: 'cliente' | 'liganer',
  model: ModelDef,
  client: ClientInfo,
  rows: ItemRow[],
  conditions: Conditions,
  summary: Summary,
  options?: { number?: string },
): void {
  if (!rows.length) return
  const fields = exportableFields(model, kind)
  const footer = footerFields(model).filter((f) => {
    if (!String(conditions[f.key] ?? '').trim()) return false
    if (kind === 'cliente' && f.key === 'frete_percentual') return false
    return true
  })
  const number = String(options?.number ?? '').trim() || localPrintNumber()
  const now = new Date().toLocaleString('pt-BR')
  const pdfClass = kind === 'liganer' ? 'pdf-liganer' : 'pdf-cliente'
  const logo = logoUrl()

  const itemRows = rows
    .map((row, index) => {
      const cells = fields
        .map((field) => {
          const value = valueForField(field, model.id, row, conditions, index)
          const text =
            field.type === 'boolean'
              ? value
                ? 'X'
                : ''
              : displayFieldValue(value, field)
          return `<td>${escapeHtml(text)}</td>`
        })
        .join('')
      return `<tr><td class="item-no">${index + 1}</td>${cells}</tr>`
    })
    .join('')

  const summaryRows = [
    ['Total (Kg)', `${formatNumber(summary.totalKg, 0)} Kg`],
    ['Subtotal', formatCurrency(summary.subtotal)],
    ['IPI 3,25%', formatCurrency(summary.ipi)],
    ['Total', formatCurrency(summary.total)],
  ]

  const summaryHtml = `
    <section class="panel">
      <h2>Totais</h2>
      <div class="kv">
        ${summaryRows
          .map(
            ([label, value]) => `
          <div>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value)}</span>
          </div>`,
          )
          .join('')}
      </div>
    </section>`

  const conditionsHtml = footer.length
    ? `
    <section class="panel">
      <h2>Condições</h2>
      <div class="kv">
        ${footer
          .map(
            (field) => `
          <div>
            <strong>${escapeHtml(fieldLabel(field.label))}</strong>
            <span>${escapeHtml(displayFieldValue(conditions[field.key], field))}</span>
          </div>`,
          )
          .join('')}
      </div>
    </section>`
    : ''

  const clientName = String(client.name ?? '').trim()
  const clientCnpj = String(client.cnpj ?? '').trim()
  const clientArticles = [
    clientName
      ? `<article>
      <span>Cliente</span>
      <strong>${escapeHtml(clientName)}</strong>
    </article>`
      : '',
    clientCnpj
      ? `<article>
      <span>CNPJ</span>
      <strong>${escapeHtml(clientCnpj)}</strong>
    </article>`
      : '',
  ].filter(Boolean)
  const clientCardHtml = clientArticles.length
    ? `<section class="client-card${clientArticles.length === 1 ? ' solo' : ''}">
    ${clientArticles.join('\n    ')}
  </section>`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(number)}</title>
  <style>
    /* A4 retrato (210×297mm). */
    @page {
      size: 210mm 297mm;
      margin: 8mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      color: #17211d;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      background: #fff;
      /* Chrome/Edge “Salvar como PDF” remove fundos sem isso. */
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    body {
      min-width: 210mm;
      max-width: 210mm;
    }
    body.pdf-liganer { font-size: 7px; }

    .print-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      gap: 8px 12px;
      margin-bottom: 10px;
    }
    .print-actions button {
      border: 0;
      border-radius: 6px;
      background: #c60000;
      color: #fff;
      padding: 8px 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .print-actions .print-hint {
      color: #56635d;
      font-size: 11px;
    }
    @media print {
      .print-actions { display: none; }
      @page {
        size: 210mm 297mm;
        margin: 8mm;
      }
      html, body {
        width: 210mm;
        min-height: 297mm;
        max-width: none;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      .banner,
      .brand img,
      table.items th,
      .panel h2,
      .client-card article,
      .kv strong {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      .banner {
        background: #c60000 !important;
        color: #fff !important;
      }
      table.items th {
        background: #c60000 !important;
        color: #fff !important;
      }
      .panel h2 {
        background: #fce8e8 !important;
        color: #c60000 !important;
      }
      .client-card article {
        background: #f2f2f2 !important;
      }
      .kv strong {
        background: #fafafa !important;
      }
    }

    .banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: #c60000;
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .brand img {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: #fff;
      object-fit: contain;
      flex: none;
    }
    .brand h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.1;
      font-weight: 800;
    }
    body.pdf-liganer .brand h1 { font-size: 14px; }
    .banner-meta {
      text-align: right;
      font-size: 11px;
      line-height: 1.45;
      white-space: nowrap;
    }
    body.pdf-liganer .banner-meta { font-size: 8px; }

    .client-card {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .client-card.solo {
      grid-template-columns: 1fr;
    }
    .client-card article {
      border: 1px solid #d8dfd9;
      border-radius: 8px;
      padding: 8px 10px;
      background: #f2f2f2;
    }
    .client-card span {
      display: block;
      color: #56635d;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 3px;
    }
    .client-card strong {
      font-size: 12px;
      font-weight: 700;
    }
    body.pdf-liganer .client-card strong { font-size: 9px; }

    table.items {
      width: max-content;
      max-width: none;
      border-collapse: collapse;
      table-layout: auto;
    }
    table.items th,
    table.items td {
      border: 1px solid #d8dfd9;
      padding: 4px 5px;
      vertical-align: middle;
      text-align: center;
      overflow: visible;
      width: auto;
      max-width: none;
      white-space: nowrap;
      word-break: keep-all;
      overflow-wrap: normal;
    }
    /* Reforça a borda direita por dentro: com zoom/scale a última 1px
       costuma ser cortada por overflow/arredondamento. */
    table.items th:last-child,
    table.items td:last-child {
      box-shadow: inset -1px 0 0 #d8dfd9;
    }
    table.items th {
      background: #c60000;
      color: #fff;
      font-size: 7px;
      font-weight: 800;
      text-transform: uppercase;
      line-height: 1.15;
      letter-spacing: 0.01em;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    table.items td {
      font-size: 7.5px;
    }
    table.items td.item-no {
      width: 1%;
      font-weight: 700;
      color: #56635d;
    }
    table.items th.item-no {
      width: 1%;
    }
    body.pdf-liganer table.items th {
      font-size: 5px;
      padding: 3px 2px;
    }
    body.pdf-liganer table.items td {
      font-size: 5.4px;
      padding: 2px 1px;
      line-height: 1.12;
    }

    .sheet-scale {
      width: 100%;
      overflow: visible;
    }
    .sheet {
      display: inline-block;
      min-width: 100%;
      transform-origin: top left;
      /* Folga para a borda direita/inferior não sumir no print com zoom. */
      padding-right: 1px;
      padding-bottom: 1px;
    }

    .bottom {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      align-items: start;
      break-inside: avoid;
    }
    .panel {
      border: 1px solid #d8dfd9;
      border-radius: 8px;
      overflow: hidden;
      height: fit-content;
      align-self: start;
    }
    .panel h2 {
      margin: 0;
      padding: 8px 10px;
      background: #fce8e8;
      color: #c60000;
      font-size: 12px;
      font-weight: 800;
      text-align: center;
      border-bottom: 1px solid #d8dfd9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    body.pdf-liganer .panel h2 { font-size: 9px; padding: 5px 8px; }
    .kv div {
      display: grid;
      grid-template-columns: 1fr 1.1fr;
      border-bottom: 1px solid #d8dfd9;
      min-height: 28px;
    }
    .kv div:last-child { border-bottom: 0; }
    .kv strong,
    .kv span {
      display: grid;
      place-items: center;
      padding: 6px 8px;
      text-align: center;
    }
    .kv strong {
      color: #56635d;
      font-size: 8px;
      text-transform: uppercase;
      border-right: 1px solid #d8dfd9;
      background: #fafafa;
    }
    .kv span {
      font-size: 11px;
      font-weight: 700;
    }
    body.pdf-liganer .kv strong { font-size: 6px; }
    body.pdf-liganer .kv span { font-size: 8px; }
  </style>
</head>
<body class="${pdfClass}">
  <div class="print-actions">
    <span class="print-hint">Orientação: retrato (vertical)</span>
    <button type="button" onclick="window.print()">Salvar em PDF</button>
  </div>

  <div class="sheet-scale">
  <div class="sheet">
  <header class="banner">
    <div class="brand">
      <img src="${escapeHtml(logo)}" alt="Liganer" width="40" height="40" />
      <div>
        <h1>Liganer</h1>
      </div>
    </div>
    <div class="banner-meta">
      <div><strong>Nº ${escapeHtml(number)}</strong></div>
      <div>${escapeHtml(now)}</div>
      <div>${rows.length} item(ns)</div>
    </div>
  </header>

  ${clientCardHtml}

  <table class="items">
    <thead>
      <tr>
        <th class="item-no">Item</th>
        ${fields
          .map((field) => `<th>${escapeHtml(fieldLabel(field.label))}</th>`)
          .join('')}
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="bottom">
    ${summaryHtml}
    ${conditionsHtml}
  </div>
  </div>
  </div>

  <script>
    function fitSheetToPage() {
      const sheet = document.querySelector('.sheet')
      const scaleBox = document.querySelector('.sheet-scale')
      if (!sheet || !scaleBox) return
      sheet.style.zoom = '1'
      sheet.style.transform = 'none'
      sheet.style.marginBottom = '0'
      const avail = scaleBox.clientWidth || document.body.clientWidth || window.innerWidth
      const needed = Math.max(sheet.scrollWidth, sheet.offsetWidth)
      if (!avail || !needed) return
      // Reserva 2px para a borda direita não ser cortada no arredondamento do zoom.
      const scale = Math.min(1, (avail - 2) / needed)
      if (scale >= 0.999) return
      if ('zoom' in sheet.style) {
        sheet.style.zoom = String(scale)
      } else {
        sheet.style.transform = 'scale(' + scale + ')'
        sheet.style.marginBottom = (-(1 - scale) * sheet.scrollHeight) + 'px'
      }
    }
    window.addEventListener('load', () => {
      fitSheetToPage()
      setTimeout(() => {
        fitSheetToPage()
        window.print()
      }, 400)
    })
    window.addEventListener('resize', fitSheetToPage)
  </script>
</body>
</html>`

  // Janela em proporção retrato. Não usar noopener: em Chrome/Edge
  // window.open(..., 'noopener') devolve null e o PDF deixa de abrir.
  const win = window.open('', '_blank', 'width=900,height=1200,left=40,top=20')
  if (!win) {
    alert('O navegador bloqueou a janela de PDF. Permita pop-ups para exportar.')
    return
  }
  try {
    win.opener = null
  } catch {
    /* ignore */
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  try {
    win.focus()
  } catch {
    /* ignore */
  }
}

const SITUACAO_REPORT_SECTIONS: {
  value: BudgetSituacao
  title: string
}[] = [
  { value: 'perdido', title: 'Perdidos' },
  { value: 'analise', title: 'Em análise' },
  { value: 'ganho', title: 'Ganhos' },
]

const MONTH_LABELS = [
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
]

function budgetReportDate(item: BudgetListItem): Date | null {
  const raw = String(item.createdAt || item.savedAt || '').trim()
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Mais antigo → mais novo (criação; desempate por número). */
function compareBudgetsOldestFirst(a: BudgetListItem, b: BudgetListItem): number {
  const da = budgetReportDate(a)?.getTime() ?? Number.POSITIVE_INFINITY
  const db = budgetReportDate(b)?.getTime() ?? Number.POSITIVE_INFINITY
  if (da !== db) return da - db
  return String(a.number ?? a.name ?? '').localeCompare(String(b.number ?? b.name ?? ''), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
}

export function filterBudgetsByMonthYear(
  items: BudgetListItem[],
  month: number,
  year: number,
): BudgetListItem[] {
  return items.filter((item) => {
    const date = budgetReportDate(item)
    if (!date) return false
    return date.getMonth() + 1 === month && date.getFullYear() === year
  })
}

function situacaoSectionTotals(items: BudgetListItem[]) {
  let totalKg = 0
  let totalRs = 0
  let withKg = 0
  let withRs = 0
  for (const item of items) {
    if (typeof item.totalKg === 'number' && Number.isFinite(item.totalKg)) {
      totalKg += item.totalKg
      withKg += 1
    }
    if (typeof item.totalRs === 'number' && Number.isFinite(item.totalRs)) {
      totalRs += item.totalRs
      withRs += 1
    }
  }
  return { count: items.length, totalKg, totalRs, withKg, withRs }
}

/** Relatório PDF das situações (perdidos / em análise / ganhos) por mês e ano. */
export function exportSituacaoReportPdf(
  items: BudgetListItem[],
  month: number,
  year: number,
): void {
  const filtered = filterBudgetsByMonthYear(items, month, year)
  const periodLabel = `${MONTH_LABELS[month - 1] || month}/${year}`
  const now = new Date().toLocaleString('pt-BR')
  const logo = logoUrl()

  if (!filtered.length) {
    alert(`Nenhum orçamento em ${periodLabel}.`)
    return
  }

  const sectionsHtml = SITUACAO_REPORT_SECTIONS.map((section) => {
    const rows = filtered
      .filter((item) => normalizeBudgetSituacao(item.situacao) === section.value)
      .sort(compareBudgetsOldestFirst)
    const totals = situacaoSectionTotals(rows)
    const body =
      rows.length === 0
        ? `<tr><td colspan="6" class="empty">Nenhum orçamento</td></tr>`
        : rows
            .map((item) => {
              const when = item.createdAt || item.savedAt
              return `<tr>
                <td>${escapeHtml(item.name || item.number || '—')}</td>
                <td>${escapeHtml(item.client?.name?.trim() || '—')}</td>
                <td>${escapeHtml(item.owner?.name?.trim() || item.owner?.email?.trim() || '—')}</td>
                <td class="num">${
                  typeof item.totalKg === 'number'
                    ? escapeHtml(`${formatNumber(item.totalKg, 0)} Kg`)
                    : '—'
                }</td>
                <td class="num">${
                  typeof item.totalRs === 'number'
                    ? escapeHtml(formatCurrency(item.totalRs))
                    : '—'
                }</td>
                <td>${when ? escapeHtml(new Date(when).toLocaleDateString('pt-BR')) : '—'}</td>
              </tr>`
            })
            .join('')

    return `
      <section class="block situacao-${section.value}">
        <h2>${escapeHtml(section.title)} <span>(${totals.count})</span></h2>
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Dono</th>
              <th class="num">Total (Kg)</th>
              <th class="num">Total (R$)</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
          <tfoot>
            <tr>
              <td colspan="3"><strong>Total ${escapeHtml(section.title.toLowerCase())}</strong></td>
              <td class="num"><strong>${escapeHtml(`${formatNumber(totals.totalKg, 0)} Kg`)}</strong></td>
              <td class="num"><strong>${escapeHtml(formatCurrency(totals.totalRs))}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </section>`
  }).join('')

  const grand = situacaoSectionTotals(filtered)
  const countBySituacao = SITUACAO_REPORT_SECTIONS.map((section) => {
    const count = filtered.filter(
      (item) => normalizeBudgetSituacao(item.situacao) === section.value,
    ).length
    return `<div><strong>${escapeHtml(section.title)}</strong><span>${count}</span></div>`
  }).join('')

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório situações ${escapeHtml(periodLabel)}</title>
  <style>
    @page { size: 210mm 297mm; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      color: #17211d;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { max-width: 210mm; }
    .print-actions {
      display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 10px;
    }
    .print-actions button {
      border: 0; border-radius: 6px; background: #c60000; color: #fff;
      padding: 8px 14px; font-weight: 700; cursor: pointer;
    }
    header.banner {
      display: flex; justify-content: space-between; gap: 16px;
      align-items: center; border-bottom: 2px solid #c60000; padding-bottom: 10px; margin-bottom: 14px;
    }
    .brand { display: flex; gap: 10px; align-items: center; }
    .brand img { width: 40px; height: 40px; }
    .brand h1 { margin: 0; font-size: 18px; color: #c60000; }
    .brand p { margin: 2px 0 0; color: #56635d; }
    .banner-meta { text-align: right; color: #56635d; }
    .banner-meta strong { color: #17211d; display: block; font-size: 12px; }
    .summary {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;
    }
    .summary div {
      border: 1px solid #d8dfd9; border-radius: 8px; padding: 8px 10px; background: #f8faf8;
    }
    .summary strong { display: block; font-size: 9px; color: #56635d; text-transform: uppercase; }
    .summary span { display: block; margin-top: 4px; font-size: 13px; font-weight: 800; }
    .block { margin-bottom: 16px; break-inside: avoid; }
    .block h2 {
      margin: 0 0 8px; font-size: 12px; padding: 6px 8px; border-radius: 6px;
    }
    .block h2 span { font-weight: 600; color: #56635d; }
    .situacao-perdido h2 { background: rgba(198,0,0,0.1); color: #c60000; }
    .situacao-analise h2 { background: rgba(255,193,7,0.18); color: #8a6d00; }
    .situacao-ganho h2 { background: rgba(47,107,79,0.12); color: #2f6b4f; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #d8dfd9; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f2f2f2; font-size: 9px; text-transform: uppercase; letter-spacing: 0.03em; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    td.empty { color: #56635d; font-style: italic; }
    tfoot td { background: #f8faf8; border-top: 1px solid #b8c2bb; }
    .grand {
      margin-top: 8px; border: 1px solid #d8dfd9; border-radius: 8px; padding: 10px 12px;
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
    }
    .grand strong { display: block; color: #56635d; font-size: 9px; text-transform: uppercase; }
    .grand span { display: block; margin-top: 4px; font-size: 14px; font-weight: 800; }
    @media print { .print-actions { display: none; } }
  </style>
</head>
<body>
  <div class="print-actions">
    <button type="button" onclick="window.print()">Salvar em PDF</button>
  </div>
  <header class="banner">
    <div class="brand">
      <img src="${escapeHtml(logo)}" alt="Liganer" width="40" height="40" />
      <div>
        <h1>Liganer</h1>
        <p>Relatório de situações dos orçamentos</p>
      </div>
    </div>
    <div class="banner-meta">
      <strong>${escapeHtml(periodLabel)}</strong>
      <div>Gerado em ${escapeHtml(now)}</div>
      <div>${grand.count} orçamento(s)</div>
    </div>
  </header>

  <section class="summary">
    ${countBySituacao}
    <div><strong>Total no período</strong><span>${grand.count}</span></div>
  </section>

  ${sectionsHtml}

  <section class="grand">
    <div>
      <strong>Total geral (Kg)</strong>
      <span>${escapeHtml(`${formatNumber(grand.totalKg, 0)} Kg`)}</span>
    </div>
    <div>
      <strong>Total geral (R$)</strong>
      <span>${escapeHtml(formatCurrency(grand.totalRs))}</span>
    </div>
    <div>
      <strong>Qtd. orçamentos</strong>
      <span>${grand.count}</span>
    </div>
  </section>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 350)
    })
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=1200,left=40,top=20')
  if (!win) {
    alert('O navegador bloqueou a janela de PDF. Permita pop-ups para exportar.')
    return
  }
  try {
    win.opener = null
  } catch {
    /* ignore */
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  try {
    win.focus()
  } catch {
    /* ignore */
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
