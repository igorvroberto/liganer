import { describe, expect, it } from 'vitest'
import { formatDecimalInput, formatNumber } from './format'

describe('formatDecimalInput', () => {
  it('usa vírgula como separador decimal', () => {
    expect(formatDecimalInput(15.65)).toBe('15,65')
    expect(formatDecimalInput(26.07810689)).toBe('26,07810689')
    expect(formatDecimalInput(40)).toBe('40')
    expect(formatDecimalInput('')).toBe('')
  })
})

describe('formatNumber (QDE com milhar)', () => {
  it('formata inteiros com separador de mil pt-BR', () => {
    expect(formatNumber(600, 0, true)).toBe('600')
    expect(formatNumber(1600, 0, true)).toBe('1.600')
    expect(formatNumber(12500, 0, true)).toBe('12.500')
  })
})
