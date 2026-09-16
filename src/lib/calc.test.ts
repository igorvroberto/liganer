import { describe, expect, it } from 'vitest'
import { calculateRow, createEmptyRow } from './calc'

describe('calculateRow (planilha Diferença preço e ICMS)', () => {
  it('reproduz a linha do tubo 5/8 com ICMS iguais', () => {
    const row = createEmptyRow({
      qty: 600,
      unit: 'm',
      ourProduct: 'TUBO RED. I-304 5/8 1,50MM IMP',
      ourIcms: 0.18,
      factorUsed: 157,
      clientPrice: 15.65,
      clientIcms: 0.18,
      priceFactor100: 26.07810689,
      reference: '960',
    })

    const result = calculateRow(row, 0.0925)

    expect(result.ourPrice).toBeCloseTo(16.6102591656, 8)
    expect(result.origin).toBeCloseTo(0.7275, 6)
    expect(result.destination).toBeCloseTo(0.7275, 6)
    expect(result.equivalentPrice).toBeCloseTo(16.6102591656, 8)
    expect(result.priceDiff).toBeCloseTo(0.0613584131, 8)
    expect(result.targetPrice).toBeCloseTo(15.65, 6)
    expect(result.targetFactor).toBeCloseTo(166.63327086, 5)
  })

  it('ajusta preço equivalente quando o ICMS do cliente é menor', () => {
    const row = createEmptyRow({
      ourIcms: 0.18,
      factorUsed: 100,
      clientPrice: 10,
      clientIcms: 0.12,
      priceFactor100: 20,
    })

    const result = calculateRow(row, 0.0925)
    // nosso preço = 20
    // origem = 1 - 0.2725 = 0.7275
    // destino = 1 - 0.2125 = 0.7875
    // equivalente = 20 * 0.7275 / 0.7875 ≈ 18.476
    expect(result.ourPrice).toBeCloseTo(20, 6)
    expect(result.equivalentPrice).toBeCloseTo(18.476190476, 6)
    expect(result.priceDiff).toBeCloseTo(0.8476190476, 6)
  })

  it('retorna null quando faltam insumos', () => {
    const result = calculateRow(createEmptyRow({ factorUsed: '', priceFactor100: '' }), 0.0925)
    expect(result.ourPrice).toBeNull()
    expect(result.equivalentPrice).toBeNull()
    expect(result.priceDiff).toBeNull()
  })
})
