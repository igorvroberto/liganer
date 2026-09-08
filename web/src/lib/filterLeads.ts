import type { Filters, Lead } from '../types'

const POT_ORDER: Record<string, number> = { Alto: 0, Médio: 1, Baixo: 2 }

export function filterLeads(leads: Lead[], f: Filters): Lead[] {
  const q = f.q.trim().toLowerCase()
  return leads.filter((l) => {
    if (f.categoria && l.categoria !== f.categoria) return false
    if (f.potencial && l.potencial !== f.potencial) return false
    if (f.cidade && l.cidade !== f.cidade) return false
    if (f.classificacao && l.classificacao_comercial !== f.classificacao) return false
    if (f.situacao && l.situacao !== f.situacao) return false
    if (f.multiproduto === 'Sim' && !/^sim/i.test(l.multiproduto)) return false
    if (f.multiproduto === 'Não' && /^sim/i.test(l.multiproduto)) return false
    if (f.visita === 'Sim' && !/^sim/i.test(l.visita_presencial)) return false
    if (f.visita === 'Não' && /^sim/i.test(l.visita_presencial)) return false
    if (!q) return true
    const hay = [
      l.empresa,
      l.cidade,
      l.categoria,
      l.subcategoria,
      l.produto_provavel,
      l.produto_secundario,
      l.motivo_prospect,
      l.proxima_acao,
      l.telefone,
      l.whatsapp,
      l.classificacao_comercial,
      l.observacoes_comerciais,
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function sortLeads(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const pa = POT_ORDER[a.potencial] ?? 9
    const pb = POT_ORDER[b.potencial] ?? 9
    if (pa !== pb) return pa - pb
    const ma = /^sim/i.test(a.multiproduto) ? 0 : 1
    const mb = /^sim/i.test(b.multiproduto) ? 0 : 1
    if (ma !== mb) return ma - mb
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
    if (/^sim/i.test(l.visita_presencial)) score += 10
    const dist = Number(l.distancia_km_aracatuba)
    if (!Number.isNaN(dist)) score += Math.max(0, 20 - dist / 10)
    return { l, score }
  })
  scored.sort((a, b) => b.score - a.score || a.l.empresa.localeCompare(b.l.empresa, 'pt-BR'))
  return scored.slice(0, limit).map((s) => s.l)
}
