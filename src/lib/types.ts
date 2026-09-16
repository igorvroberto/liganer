/** Constantes e tipos do comparador (planilha Diferença preço e ICMS). */

export const DEFAULT_PIS_COFINS = 0.0925

export type CompareRowInput = {
  id: string
  qty: number | ''
  unit: string
  ourProduct: string
  ourIcms: number | ''
  factorUsed: number | ''
  competitor: string
  clientProduct: string
  clientPrice: number | ''
  clientIcms: number | ''
  /** Preço fator 100 (coluna O da planilha). */
  priceFactor100: number | ''
  reference: string
}

export type CompareRowComputed = {
  ourPrice: number | null
  equivalentPrice: number | null
  priceDiff: number | null
  targetPrice: number | null
  targetFactor: number | null
  origin: number | null
  destination: number | null
}

export type CompareRow = CompareRowInput & CompareRowComputed

export type CompareSession = {
  clientName: string
  notes: string
  pisCofins: number
  rows: CompareRowInput[]
  updatedAt: string
}
