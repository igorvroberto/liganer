import { lookupCatalogPrice, usesPriceCatalog } from './priceCatalog'
import type { Conditions, ItemRow, RowCalculation, Summary } from './types'

export function numericValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === undefined || value === null || value === '') return 0
  const text = String(value).trim()
  if (!text) return 0
  // 1.000 / 12.345.678 (pt-BR milhar sem decimal)
  if (!text.includes(',') && /^\d{1,3}(\.\d{3})+$/.test(text)) {
    const n = Number(text.replace(/\./g, ''))
    return Number.isFinite(n) ? n : 0
  }
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/[^\d.-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

export function percentRate(value: unknown): number {
  const n = numericValue(value)
  if (!n) return 0
  // 1 = 1% (não 100%). Só valores < 1 são tratados como taxa já decimal (ex.: 0,05).
  return n >= 1 ? n / 100 : n
}

/**
 * ACE: preço unitário (KG/MT) vem do catálogo pelo material.
 * Quantidade/peso saíram do app — subtotal de linha fica 0 até nova orientação da planilha.
 */
export function calculateRow(
  modelId: string,
  row: ItemRow,
  conditions: Conditions,
): RowCalculation {
  const fatorUtilizado = numericValue(row.fator_utilizado)
  const catalog = usesPriceCatalog(modelId) ? lookupCatalogPrice(row) : null
  const catalogPrice = catalog?.precoFator100 ?? 0
  const precoFator100 = catalogPrice || numericValue(row.preco_fator_100 ?? row.preco)
  const precoBobinaFator100 = catalogPrice || numericValue(row.preco_bobina_fator_100)
  const precoServico = numericValue(row.preco_servico)
  const frete = percentRate(conditions.frete_percentual)
  const icms = catalog?.icms || percentRate(row.icms)

  const precoFatorUtilizado = fatorUtilizado ? precoFator100 / (fatorUtilizado / 100) : 0
  const precoBobinaFatorUtilizado = fatorUtilizado
    ? precoBobinaFator100 / (fatorUtilizado / 100)
    : 0

  const precoTotal = precoFatorUtilizado + precoServico
  const precoSemIpi = frete === 0 ? precoTotal : precoTotal + precoTotal * frete
  const subtotal = 0

  return {
    pesoUnitario: 0,
    pesoTotal: 0,
    precoFator100,
    precoFatorUtilizado,
    precoBobinaFator100,
    precoBobinaFatorUtilizado,
    precoTotal,
    precoSemIpi,
    subtotal,
    pesoNecessario: 0,
    quantidadeCortes: 0,
    perdaMm: 0,
    perdaPercentual: 0,
    acrescimoPerdaPercentual: 0,
    acrescimoPerdaValor: 0,
    icms,
  }
}

export function calculateSummary(
  modelId: string,
  rows: ItemRow[],
  conditions: Conditions,
): Summary {
  let subtotal = 0
  for (const row of rows) {
    const calculated = calculateRow(modelId, row, conditions)
    subtotal += calculated.subtotal
  }
  const ipi = subtotal * 0.0325
  const total = subtotal + ipi
  const frete = percentRate(conditions.frete_percentual)
  return { totalKg: 0, subtotal, ipi, total, frete }
}
