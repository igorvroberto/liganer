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

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function ownerLabel(owner: { name?: string; email?: string } | null | undefined): string {
  const name = owner?.name?.trim()
  if (name) return name
  const email = owner?.email?.trim()
  if (email) return email
  return ''
}

export function pickFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
