import type { CompareRowComputed, CompareRowInput } from './types'

export function numericValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'boolean') return value ? 1 : 0
  if (value == null || value === '') return 0
  const raw = String(value).trim().replace(/\s/g, '')
  // Aceita pt-BR (1.234,56) e decimal com ponto (14.50 / 26.078).
  let normalized = raw
  if (raw.includes(',')) {
    normalized = raw.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function hasNumber(value: number | '' | undefined | null): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Espelha as fórmulas da aba "Diferença":
 * - D = O/F*100          (nosso preço)
 * - P = 1-(PIS+E)        (origem)
 * - Q = 1-(PIS+J)        (destino)
 * - K = D*P/Q            (preço equivalente)
 * - L = K/I - 1          (diferença de preço)
 * - M = D*I/K            (preço alvo)
 * - N = O/M*100          (fator-alvo)
 */
export function calculateRow(
  row: CompareRowInput,
  pisCofins: number,
): CompareRowComputed {
  const priceFactor100 = hasNumber(row.priceFactor100) ? row.priceFactor100 : null
  const factorUsed = hasNumber(row.factorUsed) ? row.factorUsed : null
  const ourIcms = hasNumber(row.ourIcms) ? row.ourIcms : null
  const clientIcms = hasNumber(row.clientIcms) ? row.clientIcms : null
  const clientPrice = hasNumber(row.clientPrice) ? row.clientPrice : null

  const ourPrice =
    priceFactor100 != null && factorUsed != null && factorUsed !== 0
      ? (priceFactor100 / factorUsed) * 100
      : null

  const origin = ourIcms != null ? 1 - (pisCofins + ourIcms) : null
  const destination = clientIcms != null ? 1 - (pisCofins + clientIcms) : null

  const equivalentPrice =
    ourPrice != null && origin != null && destination != null && destination !== 0
      ? (ourPrice * origin) / destination
      : null

  const priceDiff =
    equivalentPrice != null && clientPrice != null && clientPrice !== 0
      ? equivalentPrice / clientPrice - 1
      : null

  const targetPrice =
    ourPrice != null &&
    clientPrice != null &&
    equivalentPrice != null &&
    equivalentPrice !== 0
      ? (ourPrice * clientPrice) / equivalentPrice
      : null

  const targetFactor =
    priceFactor100 != null && targetPrice != null && targetPrice !== 0
      ? (priceFactor100 / targetPrice) * 100
      : null

  return {
    ourPrice,
    equivalentPrice,
    priceDiff,
    targetPrice,
    targetFactor,
    origin,
    destination,
  }
}

export function createEmptyRow(partial?: Partial<CompareRowInput>): CompareRowInput {
  return {
    id: crypto.randomUUID(),
    qty: '',
    unit: 'm',
    ourProduct: '',
    ourIcms: 0.18,
    factorUsed: 157,
    observation: '',
    competitor: '',
    clientProduct: '',
    clientPrice: '',
    clientIcms: 0.18,
    priceFactor100: '',
    ...partial,
  }
}
