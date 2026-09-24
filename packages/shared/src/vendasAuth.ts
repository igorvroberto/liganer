/**
 * Auth compartilhado de vendas.liganer.com.br (/auth/me.php, /auth/users.php).
 */
export type VendasUser = {
  id: string
  email: string
  name: string
}

export type VendasSession = {
  user: VendasUser
  admin: boolean
}

export function isVendasHost(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'vendas.liganer.com.br'
}

export function normalizeVendasUser(raw: unknown): VendasUser | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const email = String(o.email ?? '').trim()
  if (!email) return null
  return {
    id: String(o.id ?? email).trim() || email,
    email,
    name: String(o.name ?? email).trim() || email,
  }
}

export async function fetchVendasSession(): Promise<VendasSession | null> {
  try {
    const res = await fetch('/auth/me.php', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      ok?: boolean
      admin?: boolean
      user?: VendasUser
    }
    const user = normalizeVendasUser(data?.user)
    if (!user) return null
    return { admin: Boolean(data.admin), user }
  } catch {
    return null
  }
}

export async function fetchVendasUser(): Promise<VendasUser | null> {
  const session = await fetchVendasSession()
  return session?.user ?? null
}

/** Lista de usuários cadastrados (GET /auth/users.php — qualquer logado). */
export async function fetchVendasUsers(): Promise<VendasUser[]> {
  try {
    const res = await fetch('/auth/users.php', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { ok?: boolean; users?: VendasUser[] }
    if (!Array.isArray(data.users)) return []
    return data.users.map(normalizeVendasUser).filter((u): u is VendasUser => u != null)
  } catch {
    return []
  }
}

export function vendasLoginUrl(nextPath = '/'): string {
  return `/login.html?next=${encodeURIComponent(nextPath)}`
}

/** Em vendas.liganer.com.br, redireciona para login se não houver sessão. */
export async function requireVendasLogin(): Promise<VendasSession | null> {
  const session = await fetchVendasSession()
  if (session) return session
  if (typeof window === 'undefined' || !isVendasHost()) return null
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.replace(vendasLoginUrl(next || '/'))
  return null
}
