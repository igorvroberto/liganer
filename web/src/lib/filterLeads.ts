import type { Filters, Lead } from '../types'
import { SITUACAO_OPTIONS, STATUS_OPTIONS } from '../types'

const POT_ORDER: Record<string, number> = { Alto: 0, Médio: 1, Baixo: 2 }

const SIT_ORDER = Object.fromEntries(SITUACAO_OPTIONS.map((s, i) => [s, i])) as Record<
  string,
  number
>

const STATUS_ORDER = Object.fromEntries(STATUS_OPTIONS.map((s, i) => [s, i])) as Record<
  string,
  number
>

export type SortKey =
  | 'potencial'
  | 'empresa'
  | 'cnpj'
  | 'cidade'
  | 'categoria'
  | 'produto_provavel'
  | 'situacao'
  | 'ultimo_contato'
  | 'status'
  | 'proximo_contato'
  | 'ultima_compra'
  | 'proxima_acao'

export type SortDir = 'asc' | 'desc'

export function filterLeads(leads: Lead[], f: Filters): Lead[] {
  const q = f.q.trim().toLowerCase()
  return leads.filter((l) => {
    if (f.categoria && l.categoria !== f.categoria) return false
    if (f.potencial && l.potencial !== f.potencial) return false
    if (f.cidade && l.cidade !== f.cidade) return false
    if (f.situacao && l.situacao !== f.situacao) return false
    if (f.status && l.status !== f.status) return false
    if (f.multiproduto === 'Sim' && !/^sim/i.test(l.multiproduto)) return false
    if (f.multiproduto === 'Não' && /^sim/i.test(l.multiproduto)) return false
    if (!q) return true
    const hay = [
      l.empresa,
      l.cnpj,
      l.cidade,
      l.categoria,
      l.subcategoria,
      l.produto_provavel,
      l.produto_secundario,
      l.motivo_prospect,
      l.proxima_acao,
      l.telefone,
      l.whatsapp,
      l.status,
      l.ultima_compra,
      l.observacoes_comerciais,
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

function dateSortValue(raw: string): number {
  const s = (raw ?? '').trim()
  if (!s) return 0
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(s)
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (br) return Date.parse(`${br[3]}-${br[2]}-${br[1]}`)
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

function cmp(a: Lead, b: Lead, key: SortKey): number {
  switch (key) {
    case 'potencial':
      return (POT_ORDER[a.potencial] ?? 9) - (POT_ORDER[b.potencial] ?? 9)
    case 'situacao':
      return (SIT_ORDER[a.situacao] ?? 99) - (SIT_ORDER[b.situacao] ?? 99)
    case 'status':
      return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
    case 'ultimo_contato':
      return dateSortValue(a.ultimo_contato ?? '') - dateSortValue(b.ultimo_contato ?? '')
    case 'proximo_contato':
      return dateSortValue(a.proximo_contato ?? '') - dateSortValue(b.proximo_contato ?? '')
    case 'ultima_compra':
      return dateSortValue(a.ultima_compra ?? '') - dateSortValue(b.ultima_compra ?? '')
    case 'categoria':
      return `${a.categoria}/${a.subcategoria}`.localeCompare(
        `${b.categoria}/${b.subcategoria}`,
        'pt-BR',
      )
    case 'produto_provavel':
      return (a.produto_provavel ?? '').localeCompare(b.produto_provavel ?? '', 'pt-BR')
    case 'proxima_acao':
      return (a.proxima_acao ?? '').localeCompare(b.proxima_acao ?? '', 'pt-BR')
    case 'cidade':
      return (a.cidade ?? '').localeCompare(b.cidade ?? '', 'pt-BR')
    case 'cnpj':
      return (a.cnpj ?? '').localeCompare(b.cnpj ?? '', 'pt-BR')
    case 'empresa':
    default:
      return (a.empresa ?? '').localeCompare(b.empresa ?? '', 'pt-BR')
  }
}

export function sortLeads(
  leads: Lead[],
  key: SortKey = 'potencial',
  dir: SortDir = 'asc',
): Lead[] {
  const factor = dir === 'asc' ? 1 : -1
  return [...leads].sort((a, b) => {
    const primary = cmp(a, b, key) * factor
    if (primary !== 0) return primary
    return a.empresa.localeCompare(b.empresa, 'pt-BR')
  })
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )
}

export function potClass(value: string): string {
  if (value === 'Alto') return 'pot-alto'
  if (value === 'Médio') return 'pot-medio'
  if (value === 'Baixo') return 'pot-baixo'
  return 'pot-outro'
}

/** Heurística do TOP 20 alinhada ao radar */
export function topAttackList(leads: Lead[], limit = 20): Lead[] {
  const scored = leads.map((l) => {
    let score = 0
    if (l.potencial === 'Alto') score += 100
    else if (l.potencial === 'Médio') score += 50
    else if (l.potencial === 'Baixo') score += 10
    if (/^sim/i.test(l.multiproduto)) score += 25
    if (/^sim/i.test(l.multioportunidade)) score += 15
    if (l.categoria === 'CD') score += 20
    if (l.consumo_estimado === 'Alto') score += 15
    if (l.compra_recorrente === 'Sim') score += 15
    const dist = Number(l.distancia_km_aracatuba)
    if (!Number.isNaN(dist)) score += Math.max(0, 20 - dist / 10)
    return { l, score }
  })
  scored.sort((a, b) => b.score - a.score || a.l.empresa.localeCompare(b.l.empresa, 'pt-BR'))
  return scored.slice(0, limit).map((s) => s.l)
}
