export function formatNumber(
  value: number,
  fractionDigits = 2,
  useGrouping = true,
): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping,
  })
}

export function formatCurrency(value: number): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatPercent(value: number, fractionDigits = 2): string {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatNullableCurrency(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return formatCurrency(value)
}

export function formatNullablePercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return formatPercent(value)
}

export function formatNullableNumber(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return formatNumber(value, digits)
}
