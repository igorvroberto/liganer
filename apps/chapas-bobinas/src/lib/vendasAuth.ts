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
  return window.location.hostname === 'vendas.liganer.com.br'
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
    if (!data?.user?.email) return null
    return {
      admin: Boolean(data.admin),
      user: {
        id: String(data.user.id || data.user.email),
        email: String(data.user.email),
        name: String(data.user.name || data.user.email),
      },
    }
  } catch {
    return null
  }
}

export async function fetchVendasUser(): Promise<VendasUser | null> {
  const session = await fetchVendasSession()
  return session?.user ?? null
}

export function vendasLoginUrl(nextPath = window.location.pathname): string {
  return `/login.html?next=${encodeURIComponent(nextPath)}`
}

/** On vendas.liganer.com.br, redirect to login when there is no session. */
export async function requireVendasLogin(): Promise<VendasSession | null> {
  const session = await fetchVendasSession()
  if (session) return session
  if (!isVendasHost()) return null
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.replace(vendasLoginUrl(next || '/'))
  return null
}
