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

/** Itens sem "IMP" na descrição: fator real 4% fixo em 170. */
export function materialHasImp(material: unknown): boolean {
  return /\bIMP\b/i.test(String(material ?? ''))
}

const FATOR_REAL_4_SEM_IMP = 170

export function resolveFatorReal4(row: ItemRow): number {
  if (!materialHasImp(row.material)) return FATOR_REAL_4_SEM_IMP
  return numericValue(row.fator_real_4)
}

/** Aplica teto de fator e fator real 4% quando o material não tem IMP. */
export function applyFatorRules(row: ItemRow): ItemRow {
  const next: ItemRow = { ...row }
  if (materialHasImp(next.material)) return next

  next.fator_real_4 = FATOR_REAL_4_SEM_IMP
  const max = numericValue(next.fator_maximo)
  const used = numericValue(next.fator_utilizado)
  if (max > FATOR_REAL_4_SEM_IMP) next.fator_maximo = FATOR_REAL_4_SEM_IMP
  if (used > FATOR_REAL_4_SEM_IMP) next.fator_utilizado = FATOR_REAL_4_SEM_IMP
  return next
}

/** Preço ICMS = Preço fator 100 ÷ (fator real ÷ 100). */
export function priceFromFatorReal(precoFator100: number, fatorReal: number): number {
  if (!precoFator100 || !fatorReal) return 0
  return (precoFator100 * 100) / fatorReal
}

/**
 * ACE: Preço ICMS 18%/4% a partir do preço fator 100 e fator real.
 * Subtotal = Qde. × preço ICMS.
 */
export function calculateRow(
  modelId: string,
  row: ItemRow,
  conditions: Conditions,
): RowCalculation {
  const catalog = usesPriceCatalog(modelId) ? lookupCatalogPrice(row) : null
  const catalogPrice = catalog?.precoFator100 ?? 0
  const precoFator100 = catalogPrice || numericValue(row.preco_fator_100 ?? row.preco)
  const precoBobinaFator100 = catalogPrice || numericValue(row.preco_bobina_fator_100)
  const frete = percentRate(conditions.frete_percentual)
  const icms = catalog?.icms || percentRate(row.icms)
  const ipiRate = percentRate(row.ipi)

  const fatorReal18 = numericValue(row.fator_real_18)
  const fatorReal4 = resolveFatorReal4(row)
  let fatorMaximo = numericValue(row.fator_maximo)
  let fatorUtilizado = numericValue(row.fator_utilizado)
  if (!materialHasImp(row.material)) {
    if (fatorMaximo > FATOR_REAL_4_SEM_IMP) fatorMaximo = FATOR_REAL_4_SEM_IMP
    if (fatorUtilizado > FATOR_REAL_4_SEM_IMP) fatorUtilizado = FATOR_REAL_4_SEM_IMP
  }

  const precoSp = priceFromFatorReal(precoFator100, fatorReal18)
  const precoCe = priceFromFatorReal(precoFator100, fatorReal4)

  const quantidade = numericValue(row.quantidade)
  const subtotalSp = quantidade && precoSp ? quantidade * precoSp : 0
  const subtotalCe = quantidade && precoCe ? quantidade * precoCe : 0
  const calculoIpiSp = subtotalSp * ipiRate
  const calculoIpiCe = subtotalCe * ipiRate
  const precoComIpiSp = precoSp ? precoSp * (1 + ipiRate) : 0
  const precoComIpiCe = precoCe ? precoCe * (1 + ipiRate) : 0
  const estoqueTotal = numericValue(row.estoque_ce) + numericValue(row.estoque_sp)

  const precoFatorUtilizado = fatorUtilizado ? precoFator100 / (fatorUtilizado / 100) : 0
  const precoBobinaFatorUtilizado = fatorUtilizado
    ? precoBobinaFator100 / (fatorUtilizado / 100)
    : 0

  const precoTotal = precoFatorUtilizado
  const precoSemIpi = frete === 0 ? precoTotal : precoTotal + precoTotal * frete
  const subtotal = subtotalSp

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
    precoSp,
    precoCe,
    subtotalSp,
    subtotalCe,
    calculoIpiSp,
    calculoIpiCe,
    precoComIpiSp,
    precoComIpiCe,
    estoqueTotal,
    pesoNecessario: 0,
    quantidadeCortes: 0,
    perdaMm: 0,
    perdaPercentual: 0,
    acrescimoPerdaPercentual: 0,
    acrescimoPerdaValor: 0,
    icms,
    ipiRate,
  }
}

export function calculateSummary(
  modelId: string,
  rows: ItemRow[],
  conditions: Conditions,
): Summary {
  let subtotalSp = 0
  let subtotalCe = 0
  let ipiSp = 0
  let ipiCe = 0
  for (const row of rows) {
    const calculated = calculateRow(modelId, row, conditions)
    subtotalSp += calculated.subtotalSp
    subtotalCe += calculated.subtotalCe
    ipiSp += calculated.calculoIpiSp
    ipiCe += calculated.calculoIpiCe
  }
  const totalSp = subtotalSp + ipiSp
  const totalCe = subtotalCe + ipiCe
  const frete = percentRate(conditions.frete_percentual)
  return {
    totalKg: 0,
    subtotal: subtotalSp,
    subtotalSp,
    subtotalCe,
    ipi: ipiSp,
    ipiSp,
    ipiCe,
    total: totalSp,
    totalSp,
    totalCe,
    frete,
  }
}
