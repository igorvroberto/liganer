import Papa from 'papaparse'
import type { Lead } from '../types'
import { CRM_OPTIONS, SITUACAO_OPTIONS, STATUS_OPTIONS } from '../types'
import { inferLinha, shortenCategoria } from './linha'

const STORAGE_KEY = 'liganer-prospeccao-leads-v7'

export type LocalStore = {
  leads: Lead[]
  updatedAt: string
}

export function loadLocalLeads(): LocalStore | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalStore
    if (!parsed?.leads?.length) return null
    return parsed
  } catch {
    return null
  }
}

export function saveLocalLeads(leads: Lead[]): void {
  const payload: LocalStore = {
    leads,
    updatedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearLocalLeads(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function downloadLeadsCsv(leads: Lead[], filename = 'LEADS.csv'): void {
  const csv = Papa.unparse(leads)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function mapSituacao(value: string | undefined): string {
  const s = (value ?? '').trim()
  if ((SITUACAO_OPTIONS as readonly string[]).includes(s)) return s
  if (s === 'Sem interesse' || s === 'Sem contato') return 'Desqualificado'
  if (!s) return 'Qualificado'
  return 'Qualificado'
}

function mapStatus(value: string | undefined): string {
  const s = (value ?? '').trim()
  if ((STATUS_OPTIONS as readonly string[]).includes(s)) return s
  return 'Sem retorno'
}

function mapCrm(value: string | undefined): string {
  const s = (value ?? '').trim()
  if ((CRM_OPTIONS as readonly string[]).includes(s)) return s
  return 'Sem cadastro'
}

const UF_RE = /\b([A-Z]{2})\b(?:\s*$|[^a-z])/i

/** UF a partir de estado, endereço (/SP) ou padrão SP do radar */
function inferEstado(lead: {
  estado?: string
  endereco?: string
  cidade?: string
}): string {
  const raw = (lead.estado ?? '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(raw)) return raw
  const end = lead.endereco ?? ''
  const slash = end.match(/\/\s*([A-Za-z]{2})\b/)
  if (slash) return slash[1].toUpperCase()
  const m = end.match(UF_RE)
  if (m) return m[1].toUpperCase()
  return 'SP'
}

/** Remove campos legados e normaliza situação/status */
export function normalizeLead(
  row: Lead & {
    visita_presencial?: string
    classificacao_comercial?: string
    multiproduto?: string
  },
): Lead {
  const {
    visita_presencial: _v,
    classificacao_comercial: _c,
    multiproduto: _m,
    ...rest
  } = row as Lead & {
    visita_presencial?: string
    classificacao_comercial?: string
    multiproduto?: string
  }
  const linha = inferLinha(rest)
  return {
    ...rest,
    categoria: shortenCategoria(rest.categoria),
    linha,
    estado: inferEstado(rest),
    responsavel: rest.responsavel ?? '',
    crm: mapCrm(rest.crm),
    vendedor: rest.vendedor ?? '',
    indicacao: rest.indicacao ?? '',
    observacoes_comerciais: rest.observacoes_comerciais ?? '',
    ultimo_contato: rest.ultimo_contato ?? '',
    proximo_contato: rest.proximo_contato ?? '',
    ultima_compra: rest.ultima_compra ?? '',
    status: mapStatus(rest.status),
    situacao: mapSituacao(rest.situacao),
  } as Lead
}

/** Próximo id ARA-NNN a partir dos leads existentes */
export function nextLeadId(leads: Lead[]): string {
  let max = 0
  for (const l of leads) {
    const m = /^ARA-(\d+)$/i.exec((l.id ?? '').trim())
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `ARA-${String(max + 1).padStart(3, '0')}`
}

/** Lead em branco para inclusão manual (empresa preenchida para passar no sync) */
export function createEmptyLead(leads: Lead[]): Lead {
  const today = new Date().toLocaleDateString('pt-BR')
  return normalizeLead({
    id: nextLeadId(leads),
    empresa: 'Nova empresa',
    cnpj: '',
    cidade: '',
    estado: 'SP',
    distancia_km_aracatuba: '',
    categoria: 'Construtora',
    subcategoria: '',
    linha: 'Ferro para construção',
    produto_provavel: '',
    produto_secundario: '',
    justificativa_produto: '',
    potencial: 'Médio',
    multioportunidade: 'Não',
    consumo_estimado: '',
    compra_recorrente: '',
    tipo_operacao: '',
    o_que_fabrica_constroi: '',
    obras_atuais: '',
    fornecedor_atual: '',
    comprador: '',
    cargo_comprador: '',
    telefone: '',
    whatsapp: '',
    email: '',
    site: '',
    endereco: '',
    fonte: 'Inclusão manual',
    data_pesquisa: today,
    ultimo_contato: '',
    status: 'Sem retorno',
    proximo_contato: '',
    ultima_compra: '',
    responsavel: '',
    crm: 'Sem cadastro',
    vendedor: '',
    situacao: 'Qualificado',
    proxima_acao: '',
    necessidade_identificada: '',
    motivo_prospect: '',
    abordagem: '',
    observacoes_comerciais: '',
    indicacao: '',
  })
}
