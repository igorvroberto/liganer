import * as XLSX from 'xlsx'
import { calculateRow } from './calc'
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatNullableCurrency,
  formatNullableNumber,
  formatNullablePercent,
} from './format'
import { localPrintNumber } from './storage'
import type { CompareRowInput } from './types'

function cell(value: number | null | string, fallback = ''): string | number {
  if (value == null || value === '') return fallback
  return value
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function logoUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${window.location.origin}${base}liganer_favicon.webp`
}

function summaryFromRows(rows: CompareRowInput[], pisCofins: number) {
  const diffs = rows
    .map((row) => calculateRow(row, pisCofins).priceDiff)
    .filter((value): value is number => value != null && Number.isFinite(value))
  const avgDiff =
    diffs.length === 0 ? null : diffs.reduce((sum, value) => sum + value, 0) / diffs.length
  const above = diffs.filter((value) => value > 0).length
  const below = diffs.filter((value) => value < 0).length
  return { avgDiff, above, below }
}

const EXPORT_HEADERS = [
  'Qde',
  'UM',
  'Nosso produto',
  'Nosso preço',
  'Nosso ICMS',
  'Fator',
  'Concorrente',
  'Produto cliente',
  'Preço cliente',
  'ICMS cliente',
  'Preço equivalente',
  'Diferença preço',
  'Preço alvo',
  'Fator-alvo',
  'Preço fator 100',
  'Origem',
  'Destino',
] as const

function rowExportValues(row: CompareRowInput, pisCofins: number): (string | number)[] {
  const c = calculateRow(row, pisCofins)
  return [
    row.qty === '' ? '' : row.qty,
    row.unit,
    row.ourProduct,
    c.ourPrice == null ? '' : Number(c.ourPrice.toFixed(6)),
    row.ourIcms === '' ? '' : row.ourIcms,
    row.factorUsed === '' ? '' : row.factorUsed,
    row.competitor,
    row.clientProduct,
    row.clientPrice === '' ? '' : row.clientPrice,
    row.clientIcms === '' ? '' : row.clientIcms,
    c.equivalentPrice == null ? '' : Number(c.equivalentPrice.toFixed(6)),
    c.priceDiff == null ? '' : Number(c.priceDiff.toFixed(6)),
    c.targetPrice == null ? '' : Number(c.targetPrice.toFixed(6)),
    c.targetFactor == null ? '' : Number(c.targetFactor.toFixed(6)),
    row.priceFactor100 === '' ? '' : row.priceFactor100,
    c.origin == null ? '' : Number(c.origin.toFixed(6)),
    c.destination == null ? '' : Number(c.destination.toFixed(6)),
  ]
}

export function exportComparisonExcel(
  rows: CompareRowInput[],
  pisCofins: number,
  meta: { clientName: string; number?: string },
): void {
  const body = rows.map((row) => rowExportValues(row, pisCofins))
  const sheet = XLSX.utils.aoa_to_sheet([
    ['PIS + COFINS', pisCofins],
    ['Cliente', meta.clientName],
    [],
    [...EXPORT_HEADERS],
    ...body,
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Diferença')
  const stamp = meta.number?.trim() || new Date().toISOString().slice(0, 10)
  XLSX.writeFile(book, `liganer-comparador-preco-${stamp}.xlsx`)
}

export function exportComparisonCsv(rows: CompareRowInput[], pisCofins: number): string {
  const lines = [
    `PIS+COFINS;${pisCofins}`,
    EXPORT_HEADERS.join(';'),
    ...rows.map((row) => {
      const c = calculateRow(row, pisCofins)
      return [
        cell(row.qty),
        row.unit,
        row.ourProduct,
        c.ourPrice == null ? '' : formatNumber(c.ourPrice, 4),
        row.ourIcms === '' ? '' : formatPercent(Number(row.ourIcms)),
        cell(row.factorUsed),
        row.competitor,
        row.clientProduct,
        row.clientPrice === '' ? '' : formatCurrency(Number(row.clientPrice)),
        row.clientIcms === '' ? '' : formatPercent(Number(row.clientIcms)),
        c.equivalentPrice == null ? '' : formatCurrency(c.equivalentPrice),
        c.priceDiff == null ? '' : formatPercent(c.priceDiff),
        c.targetPrice == null ? '' : formatCurrency(c.targetPrice),
        c.targetFactor == null ? '' : formatNumber(c.targetFactor, 2),
        row.priceFactor100 === '' ? '' : formatNumber(Number(row.priceFactor100), 4, false),
        c.origin == null ? '' : formatNumber(c.origin, 4),
        c.destination == null ? '' : formatNumber(c.destination, 4),
      ].join(';')
    }),
  ]
  return lines.join('\n')
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportComparisonPdf(
  rows: CompareRowInput[],
  pisCofins: number,
  meta: { clientName: string; number?: string },
): void {
  if (!rows.length) return

  const number = String(meta.number ?? '').trim() || localPrintNumber()
  const now = new Date().toLocaleString('pt-BR')
  const logo = logoUrl()
  const clientName = String(meta.clientName ?? '').trim()
  const summary = summaryFromRows(rows, pisCofins)

  const headers = [
    '#',
    'Qde',
    'UM',
    'Nosso produto',
    'Nosso preço',
    'Nosso ICMS',
    'Fator',
    'Concorrente',
    'Produto cliente',
    'Preço cliente',
    'ICMS cliente',
    'Preço equiv.',
    'Diferença',
    'Preço alvo',
    'Fator-alvo',
  ]

  const itemRows = rows
    .map((row, index) => {
      const c = calculateRow(row, pisCofins)
      const cells = [
        String(index + 1),
        row.qty === '' ? '—' : formatNumber(Number(row.qty), 0),
        row.unit || '—',
        row.ourProduct || '—',
        formatNullableCurrency(c.ourPrice),
        row.ourIcms === '' ? '—' : formatPercent(Number(row.ourIcms)),
        row.factorUsed === '' ? '—' : formatNumber(Number(row.factorUsed), 0),
        row.competitor || '—',
        row.clientProduct || '—',
        row.clientPrice === '' ? '—' : formatCurrency(Number(row.clientPrice)),
        row.clientIcms === '' ? '—' : formatPercent(Number(row.clientIcms)),
        formatNullableCurrency(c.equivalentPrice),
        formatNullablePercent(c.priceDiff),
        formatNullableCurrency(c.targetPrice),
        formatNullableNumber(c.targetFactor, 2),
      ]
      return `<tr>${cells.map((text) => `<td>${escapeHtml(text)}</td>`).join('')}</tr>`
    })
    .join('')

  const metaArticles = clientName
    ? `<article><span>Cliente</span><strong>${escapeHtml(clientName)}</strong></article>`
    : ''

  const summaryHtml = `
  <section class="summary-card">
    <article>
      <span>Diferença média</span>
      <strong>${escapeHtml(formatNullablePercent(summary.avgDiff))}</strong>
    </article>
    <article>
      <span>Acima / abaixo</span>
      <strong>${summary.above} / ${summary.below}</strong>
    </article>
  </section>`

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(number)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      color: #17211d;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 9px;
      background: #fff;
    }
    .print-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
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
    @media print { .print-actions { display: none; } }
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
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand img {
      width: 40px; height: 40px; border-radius: 8px; background: #fff; object-fit: contain;
    }
    .brand h1 { margin: 0; font-size: 18px; }
    .banner-meta { text-align: right; }
    .meta-card {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .meta-card article,
    .summary-card article {
      background: #f7f7f7;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .meta-card span,
    .summary-card span {
      display: block;
      color: #5c5c5c;
      font-size: 8px;
      font-weight: 700;
    }
    .meta-card strong,
    .summary-card strong { font-size: 11px; }
    .summary-card {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 12px;
    }
    table.items {
      width: 100%;
      border-collapse: collapse;
    }
    table.items th, table.items td {
      border: 1px solid #e0e0e0;
      padding: 4px 5px;
      text-align: left;
      vertical-align: top;
      white-space: nowrap;
    }
    table.items th {
      background: #fce8e8;
      font-size: 7px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button type="button" onclick="window.print()">Salvar em PDF</button>
  </div>
  <header class="banner">
    <div class="brand">
      <img src="${escapeHtml(logo)}" alt="Liganer" width="40" height="40" />
      <div><h1>Comparador de preço</h1></div>
    </div>
    <div class="banner-meta">
      <div><strong>Nº ${escapeHtml(number)}</strong></div>
      <div>${escapeHtml(now)}</div>
    </div>
  </header>
  ${metaArticles ? `<section class="meta-card">${metaArticles}</section>` : ''}
  <table class="items">
    <thead>
      <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  ${summaryHtml}
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 400)
    })
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1200,height=900,left=40,top=20')
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
