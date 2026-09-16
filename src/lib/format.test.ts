import { describe, expect, it } from 'vitest'
import { formatDecimalInput } from './format'

describe('formatDecimalInput', () => {
  it('usa vírgula como separador decimal', () => {
    expect(formatDecimalInput(15.65)).toBe('15,65')
    expect(formatDecimalInput(26.07810689)).toBe('26,07810689')
    expect(formatDecimalInput(40)).toBe('40')
    expect(formatDecimalInput('')).toBe('')
  })
})
