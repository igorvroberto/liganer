import * as XLSX from 'xlsx'
import { calculateRow } from './calc'
import { formatCurrency, formatNumber, formatPercent } from './format'
import type { CompareRowInput } from './types'

function cell(value: number | null | string, fallback = ''): string | number {
  if (value == null || value === '') return fallback
  return value
}

export function exportComparisonExcel(
  rows: CompareRowInput[],
  pisCofins: number,
  meta: { clientName: string; notes: string },
): void {
  const header = [
    'Qde',
    'UM',
    'Nosso produto',
    'Nosso preço',
    'Nosso ICMS',
    'Fator utilizado',
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
    'Referência',
  ]

  const body = rows.map((row) => {
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
      row.reference,
    ]
  })

  const sheet = XLSX.utils.aoa_to_sheet([
    ['PIS + COFINS', pisCofins],
    ['Cliente', meta.clientName],
    ['Observações', meta.notes],
    [],
    header,
    ...body,
  ])

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Diferença')
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(book, `liganer-comparador-preco-${stamp}.xlsx`)
}

export function exportComparisonCsv(
  rows: CompareRowInput[],
  pisCofins: number,
): string {
  const header = [
    'Qde',
    'UM',
    'Nosso produto',
    'Nosso preço',
    'Nosso ICMS',
    'Fator utilizado',
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
    'Referência',
  ]

  const lines = [
    `PIS+COFINS;${pisCofins}`,
    header.join(';'),
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
        cell(row.priceFactor100),
        c.origin == null ? '' : formatNumber(c.origin, 4),
        c.destination == null ? '' : formatNumber(c.destination, 4),
        row.reference,
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
