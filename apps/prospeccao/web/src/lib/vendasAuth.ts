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
    return data.users
      .map((u) => ({
        id: String(u.id || u.email),
        email: String(u.email || ''),
        name: String(u.name || u.email || '').trim(),
      }))
      .filter((u) => u.name)
  } catch {
    return []
  }
}
