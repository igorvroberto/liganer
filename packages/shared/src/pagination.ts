export const SAVED_PAGE_SIZE = 10

export function pageCount(total: number, pageSize = SAVED_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize))
}

export function slicePage<T>(items: T[], page: number, pageSize = SAVED_PAGE_SIZE): T[] {
  const count = pageCount(items.length, pageSize)
  const safe = Math.min(Math.max(1, page), count)
  const start = (safe - 1) * pageSize
  return items.slice(start, start + pageSize)
}

export function collectYearsFromItems(
  items: { createdAt?: string | null; savedAt?: string | null }[],
  fallbackYear = new Date().getFullYear(),
): number[] {
  const years = new Set<number>([fallbackYear])
  for (const item of items) {
    const raw = item.createdAt || item.savedAt
    if (!raw) continue
    const year = new Date(raw).getFullYear()
    if (Number.isFinite(year)) years.add(year)
  }
  return [...years].sort((a, b) => b - a)
}
