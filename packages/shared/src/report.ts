import { escapeHtml, formatCurrency, formatNumber, ownerLabel } from './format'
import { normalizeBudgetSituacao, SITUACAO_OPTIONS } from './situacao'
import { MONTH_OPTIONS } from './sort'
import type { BudgetSituacao, SavedListItem } from './types'

function budgetReportDate(item: SavedListItem): Date | null {
  const raw = String(item.createdAt || item.savedAt || '').trim()
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Mais antigo → mais novo (criação; desempate por número). */
export function compareBudgetsOldestFirst(a: SavedListItem, b: SavedListItem): number {
  const da = budgetReportDate(a)?.getTime() ?? Number.POSITIVE_INFINITY
  const db = budgetReportDate(b)?.getTime() ?? Number.POSITIVE_INFINITY
  if (da !== db) return da - db
  return String(a.number ?? a.name ?? '').localeCompare(String(b.number ?? b.name ?? ''), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  })
}

export function filterBudgetsByMonthYear(
  items: SavedListItem[],
  month: number,
  year: number,
): SavedListItem[] {
  return items.filter((item) => {
    const date = budgetReportDate(item)
    if (!date) return false
    return date.getMonth() + 1 === month && date.getFullYear() === year
  })
}

export function situacaoSectionTotals(items: SavedListItem[]) {
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

export type SituacaoReportOptions = {
  month: number
  year: number
  logoUrl?: string
  /** Subtítulo do relatório. */
  subtitle?: string
  /** Rótulo singular (ex.: "orçamento" / "comparação"). */
  entityLabel?: string
}

/** Relatório PDF das situações (perdidos / em análise / ganhos) por mês e ano. */
export function exportSituacaoReportPdf(
  items: SavedListItem[],
  options: SituacaoReportOptions,
): void {
  const { month, year } = options
  const entityLabel = options.entityLabel || 'orçamento'
  const entityPlural = entityLabel === 'comparação' ? 'comparações' : `${entityLabel}s`
  const subtitle = options.subtitle || `Relatório de situações dos ${entityPlural}`
  const filtered = filterBudgetsByMonthYear(items, month, year)
  const periodLabel = `${MONTH_OPTIONS[month - 1] || month}/${year}`
  const now = new Date().toLocaleString('pt-BR')
  const logo =
    options.logoUrl ||
    `${window.location.origin}${(import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL || '/'}liganer_favicon.webp`

  if (!filtered.length) {
    alert(`Nenhum ${entityLabel} em ${periodLabel}.`)
    return
  }

  const sectionsHtml = SITUACAO_OPTIONS.map((section) => {
    const rows = filtered
      .filter((item) => normalizeBudgetSituacao(item.situacao) === section.value)
      .sort(compareBudgetsOldestFirst)
    const totals = situacaoSectionTotals(rows)
    const body =
      rows.length === 0
        ? `<tr><td colspan="6" class="empty">Nenhum ${escapeHtml(entityLabel)}</td></tr>`
        : rows
            .map((item) => {
              const when = item.createdAt || item.savedAt
              return `<tr>
                <td>${escapeHtml(item.name || item.number || '—')}</td>
                <td>${escapeHtml(item.clientName?.trim() || '—')}</td>
                <td>${escapeHtml(ownerLabel(item.owner) || '—')}</td>
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
        <h2>${escapeHtml(section.reportTitle)} <span>(${totals.count})</span></h2>
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
              <td colspan="3"><strong>Total ${escapeHtml(section.reportTitle.toLowerCase())}</strong></td>
              <td class="num"><strong>${escapeHtml(`${formatNumber(totals.totalKg, 0)} Kg`)}</strong></td>
              <td class="num"><strong>${escapeHtml(formatCurrency(totals.totalRs))}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </section>`
  }).join('')

  const grand = situacaoSectionTotals(filtered)
  const countBySituacao = SITUACAO_OPTIONS.map((section) => {
    const count = filtered.filter(
      (item) => normalizeBudgetSituacao(item.situacao) === (section.value as BudgetSituacao),
    ).length
    return `<div><strong>${escapeHtml(section.reportTitle)}</strong><span>${count}</span></div>`
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
        <p>${escapeHtml(subtitle)}</p>
      </div>
    </div>
    <div class="banner-meta">
      <strong>${escapeHtml(periodLabel)}</strong>
      <div>Gerado em ${escapeHtml(now)}</div>
      <div>${grand.count} ${escapeHtml(entityLabel)}(s)</div>
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
      <strong>Qtd. ${escapeHtml(entityPlural)}</strong>
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
