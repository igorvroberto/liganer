import type { Lead } from '../types'
import type { VendasSession } from './vendasAuth'

/** Dono padrão quando a coluna Usuário (CSV `indicacao`) está vazia. */
export const DEFAULT_LEAD_OWNER = 'Igor Roberto'

export function leadOwner(indicacao: string | undefined | null): string {
  const v = (indicacao ?? '').trim()
  return v || DEFAULT_LEAD_OWNER
}

export function isLeadAdmin(session: VendasSession | null): boolean {
  if (!session) return true // dev local sem login: mostra tudo
  if (session.admin) return true
  return session.user.email.toLowerCase() === 'igor.roberto@liganer.com.br'
}

/** Igor (admin) vê todos; demais só leads cujo dono = seu nome. */
export function canViewLead(lead: Lead, session: VendasSession | null): boolean {
  if (isLeadAdmin(session)) return true
  if (!session) return true
  return leadOwner(lead.indicacao) === session.user.name.trim()
}

export function scopeLeadsForSession(leads: Lead[], session: VendasSession | null): Lead[] {
  if (isLeadAdmin(session)) return leads
  return leads.filter((l) => canViewLead(l, session))
}

/** Valor a gravar em `indicacao` para um lead novo deste usuário. */
export function defaultIndicacaoForSession(session: VendasSession | null): string {
  if (!session || isLeadAdmin(session)) return ''
  return session.user.name.trim()
}
