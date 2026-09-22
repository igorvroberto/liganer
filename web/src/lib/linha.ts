import type { Lead } from '../types'
import { LINHA_OPTIONS, type Linha } from '../types'

/** Quebra "Carbono; Inox" na ordem canônica */
export function parseLinha(raw: string | undefined): Linha[] {
  const parts = (raw ?? '')
    .split(/[;,|/]/)
    .map((p) => p.trim())
    .filter(Boolean)
  return LINHA_OPTIONS.filter((opt) => parts.includes(opt))
}

export function formatLinha(values: readonly string[]): string {
  return LINHA_OPTIONS.filter((opt) => values.includes(opt)).join('; ')
}

/** Categoria detalhada (legado) → operação curta */
const DETALHADA_PARA_CURTA: Record<string, string> = {
  Construtora: 'Construtora',
  'Corte e dobra ferro para construção': 'Corte e dobra',
  'Corte e dobra de ferro para construção': 'Corte e dobra',
  'Corte e dobra carbono': 'Corte e dobra',
  'Corte e dobra de aço carbono': 'Corte e dobra',
  'Corte e dobra inox': 'Corte e dobra',
  'Corte e dobra de aço inox': 'Corte e dobra',
  'Indústria inox': 'Indústria',
  'Indústria carbono': 'Indústria',
  'Metalúrgica inox': 'Metalúrgica',
  'Metalúrgica carbono': 'Metalúrgica',
  'Revenda ferro para construção': 'Revenda',
  'Revenda inox': 'Revenda',
  'Revenda carbono': 'Revenda',
  Distribuição: 'Revenda',
}

const CATEGORIAS_CURTAS = new Set([
  'Construtora',
  'Corte e dobra',
  'Indústria',
  'Metalúrgica',
  'Revenda',
  'Pré-moldados',
  'Artefatos de concreto',
  'Fundações',
  'Infraestrutura',
  'Silos e estruturas agro',
  'Tanques e vasos',
])

export function shortenCategoria(nome: string | undefined): string {
  const n = (nome ?? '').trim()
  if (!n) return 'Metalúrgica'
  if (CATEGORIAS_CURTAS.has(n)) return n
  return DETALHADA_PARA_CURTA[n] ?? n
}

const LINHA_POR_CATEGORIA: Record<string, Linha> = {
  Construtora: 'Ferro para construção',
  'Corte e dobra ferro para construção': 'Ferro para construção',
  'Corte e dobra de ferro para construção': 'Ferro para construção',
  'Revenda ferro para construção': 'Ferro para construção',
  'Pré-moldados': 'Ferro para construção',
  'Artefatos de concreto': 'Ferro para construção',
  Fundações: 'Ferro para construção',
  Infraestrutura: 'Ferro para construção',
  'Corte e dobra carbono': 'Carbono',
  'Corte e dobra de aço carbono': 'Carbono',
  'Revenda carbono': 'Carbono',
  'Metalúrgica carbono': 'Carbono',
  'Indústria carbono': 'Carbono',
  'Silos e estruturas agro': 'Carbono',
  'Tanques e vasos': 'Carbono',
  'Corte e dobra inox': 'Inox',
  'Corte e dobra de aço inox': 'Inox',
  'Revenda inox': 'Inox',
  'Metalúrgica inox': 'Inox',
  'Indústria inox': 'Inox',
}

const CAT_SEM_MATERIAL = new Set(['Corte e dobra', 'Indústria', 'Metalúrgica', 'Revenda'])

/** Infere linha quando o CSV/local ainda não tem o campo */
export function inferLinha(lead: Partial<Lead>): string {
  const existing = parseLinha(lead.linha)
  if (existing.length) return formatLinha(existing)

  const found = new Set<Linha>()
  const cat = (lead.categoria ?? '').trim()
  const base = LINHA_POR_CATEGORIA[cat]
  if (base) found.add(base)

  const multi = /^sim/i.test(lead.multioportunidade ?? '')
  const blob = [
    lead.produto_provavel,
    lead.produto_secundario,
    lead.justificativa_produto,
  ]
    .join(' ')
    .toLowerCase()

  const precisaBlob = multi || found.size === 0 || CAT_SEM_MATERIAL.has(cat)

  if (precisaBlob) {
    if (/(ca-50|ca-60|vergalhão|si 50|armadura|treliça|trelica)/.test(blob)) {
      found.add('Ferro para construção')
    }
    if (/(chapa|carbono|metalon|laminad)/.test(blob)) {
      found.add('Carbono')
    } else if (
      blob.includes('bobina') &&
      !/(ca-50|ca-60|vergalhão|si 50)/.test(blob)
    ) {
      found.add('Carbono')
    }
    if (blob.includes('inox')) {
      found.add('Inox')
    }
  }

  if (found.size === 0 && base) found.add(base)
  if (found.size === 0) found.add('Carbono')
  return formatLinha([...found])
}

export function leadHasLinha(lead: Lead, linha: string): boolean {
  if (!linha) return true
  return parseLinha(lead.linha).includes(linha as Linha)
}
