import * as XLSX from 'xlsx'
import fallbackCatalog from '../data/precos-ace.json'
import type { ItemRow } from './types'

/**
 * Linha do catálogo ACE (planilha precos-ace.xlsx).
 * Layout atual observado (sem cabeçalhos nomeados):
 *   A código | B material | C UM | D preço | E/F reservados (orientação posterior)
 */
export type PriceCatalogRow = {
  codigo: string
  material: string
  um: string
  preco: number
  estoque: number
  valor: number
  icms: number
}

type CatalogFile = {
  source: string
  rows: PriceCatalogRow[]
}

export type ParsedPriceWorkbook = {
  rows: PriceCatalogRow[]
}

function numericValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === undefined || value === null || value === '') return 0
  const text = String(value).trim()
  if (!text) return 0
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/[^\d.-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function normalizeSearch(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

function roundPrice(value: unknown): number {
  const n = numericValue(value)
  return n ? Math.round(n * 1e6) / 1e6 : 0
}

function findHeaderColumn(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const exact = headers.findIndex((header) => header === alias)
    if (exact >= 0) return exact
  }
  for (const alias of aliases) {
    const partial = headers.findIndex((header) => header.includes(alias))
    if (partial >= 0) return partial
  }
  return -1
}

function looksLikeNamedHeader(headers: string[]): boolean {
  const joined = headers.join(' ')
  return (
    joined.includes('material') ||
    joined.includes('descricao') ||
    joined.includes('produto') ||
    joined.includes('preco') ||
    joined.includes('um')
  )
}

function looksLikePlaceholderHeader(headers: string[]): boolean {
  return headers.some((h) => /^column\d+$/i.test(h) || /^col(una)?\s*\d+$/i.test(h))
}

function rowFromCells(
  codigo: unknown,
  material: unknown,
  um: unknown,
  preco: unknown,
  estoque: unknown,
  valor: unknown,
  icms: unknown,
): PriceCatalogRow | null {
  const materialText = String(material ?? '').trim()
  if (!materialText) return null
  if (/^column\d+$/i.test(materialText) || normalizeHeader(materialText) === 'material') {
    return null
  }
  return {
    codigo: String(codigo ?? '').trim(),
    material: materialText,
    um: String(um ?? '').trim().toUpperCase() || 'KG',
    preco: roundPrice(preco),
    estoque: numericValue(estoque),
    valor: roundPrice(valor),
    icms: numericValue(icms),
  }
}

/** Converte a 1ª aba do Excel no formato interno do catálogo ACE. */
export function parsePriceWorkbook(buffer: ArrayBuffer | Uint8Array): ParsedPriceWorkbook {
  const book = XLSX.read(buffer, { type: 'array' })
  const sheetName = book.SheetNames[0]
  if (!sheetName) return { rows: [] }
  const sheet = book.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  })
  if (!matrix.length) return { rows: [] }

  const headers = (matrix[0] || []).map(normalizeHeader)
  const named = looksLikeNamedHeader(headers) && !looksLikePlaceholderHeader(headers)
  const rows: PriceCatalogRow[] = []

  if (named) {
    const colMaterial = findHeaderColumn(headers, ['material', 'descricao', 'produto', 'item'])
    const colUm = findHeaderColumn(headers, ['um', 'unidade', 'unidade medida'])
    const colPreco = findHeaderColumn(headers, ['preco', 'preço', 'preco fator 100', 'valor unitario'])
    const colCodigo = findHeaderColumn(headers, ['codigo', 'código', 'cod', 'sku', 'id'])
    const colEstoque = findHeaderColumn(headers, ['estoque', 'saldo', 'qtd estoque'])
    const colValor = findHeaderColumn(headers, ['valor', 'valor total'])
    const colIcms = findHeaderColumn(headers, ['icms'])
    if (colMaterial < 0) return { rows: [] }

    for (let r = 1; r < matrix.length; r += 1) {
      const line = matrix[r] || []
      const parsed = rowFromCells(
        colCodigo >= 0 ? line[colCodigo] : '',
        line[colMaterial],
        colUm >= 0 ? line[colUm] : 'KG',
        colPreco >= 0 ? line[colPreco] : 0,
        colEstoque >= 0 ? line[colEstoque] : 0,
        colValor >= 0 ? line[colValor] : 0,
        colIcms >= 0 ? line[colIcms] : 0,
      )
      if (parsed) rows.push(parsed)
    }
    return { rows }
  }

  // Layout posicional atual do HostGator (Column1…Column6 ou dados desde a 1ª linha).
  const start = looksLikePlaceholderHeader(headers) ? 1 : 0
  for (let r = start; r < matrix.length; r += 1) {
    const line = matrix[r] || []
    const parsed = rowFromCells(line[0], line[1], line[2], line[3], line[4], line[5], 0)
    if (parsed) rows.push(parsed)
  }
  return { rows }
}

function buildIndex(rows: PriceCatalogRow[]): Map<string, PriceCatalogRow> {
  const next = new Map<string, PriceCatalogRow>()
  for (const row of rows) {
    const key = normalizeSearch(row.material)
    if (key && !next.has(key)) next.set(key, row)
  }
  return next
}

const fallback = fallbackCatalog as CatalogFile
let sourceLabel = fallback.source || 'fallback-json'
let catalogRows: PriceCatalogRow[] = fallback.rows
let index = buildIndex(catalogRows)

export function getPriceCatalogMeta(): { source: string; rows: number } {
  return { source: sourceLabel, rows: catalogRows.length }
}

export function setPriceCatalogRows(rows: PriceCatalogRow[], source: string): void {
  catalogRows = rows
  sourceLabel = source
  index = buildIndex(rows)
}

/**
 * Planilha ACE (fora deste deploy):
 * https://vendas.liganer.com.br/orcamento/tabelas/precos-ace.xlsx
 */
export const SHARED_PRICE_WORKBOOK_PATH = '/orcamento/tabelas/precos-ace.xlsx'

/** URL pública do Excel compartilhado em /orcamento/tabelas/. */
export function priceWorkbookUrl(): string {
  return SHARED_PRICE_WORKBOOK_PATH
}

/**
 * Busca o Excel no servidor e atualiza o catálogo em memória.
 * Se falhar, mantém o JSON embutido no build.
 */
export async function loadPriceCatalogFromExcel(
  url: string = priceWorkbookUrl(),
): Promise<{ ok: boolean; rows: number; source: string; error?: string }> {
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      return {
        ok: false,
        rows: catalogRows.length,
        source: sourceLabel,
        error: `HTTP ${response.status}`,
      }
    }
    const buffer = await response.arrayBuffer()
    const parsed = parsePriceWorkbook(buffer)
    if (!parsed.rows.length) {
      return {
        ok: false,
        rows: catalogRows.length,
        source: sourceLabel,
        error: 'Planilha sem linhas válidas',
      }
    }
    setPriceCatalogRows(parsed.rows, url)
    return { ok: true, rows: parsed.rows.length, source: url }
  } catch (error) {
    return {
      ok: false,
      rows: catalogRows.length,
      source: sourceLabel,
      error: error instanceof Error ? error.message : 'Falha ao carregar planilha',
    }
  }
}

export function findPriceRow(row: ItemRow): PriceCatalogRow | null {
  const key = normalizeSearch(row.material)
  if (!key) return null
  return index.get(key) ?? null
}

export type CatalogLookup = {
  precoFator100: number
  icms: number
  um: string
  matched: boolean
}

export function lookupCatalogPrice(row: ItemRow): CatalogLookup {
  const priceRow = findPriceRow(row)
  if (!priceRow) {
    return { precoFator100: 0, icms: 0, um: '', matched: false }
  }
  return {
    precoFator100: priceRow.preco || 0,
    icms: priceRow.icms || 0,
    um: priceRow.um || '',
    matched: priceRow.preco > 0,
  }
}

export function usesPriceCatalog(modelId: string): boolean {
  return modelId === 'chapas'
}

/** Materiais do catálogo filtrados por texto livre (typeahead). */
export function searchCatalogMaterials(query: string, limit = 20): PriceCatalogRow[] {
  const q = normalizeSearch(query)
  if (!q) {
    return catalogRows.slice(0, limit)
  }
  const tokens = q.split(' ').filter(Boolean)
  const scored: { row: PriceCatalogRow; score: number }[] = []
  for (const row of catalogRows) {
    const hay = normalizeSearch(row.material)
    if (!tokens.every((token) => hay.includes(token))) continue
    const starts = hay.startsWith(q) ? 0 : 1
    const early = hay.indexOf(tokens[0])
    scored.push({ row, score: starts * 1000 + early })
  }
  scored.sort((a, b) => a.score - b.score || a.row.material.localeCompare(b.row.material, 'pt-BR'))
  return scored.slice(0, limit).map((item) => item.row)
}

/** Ao escolher um material do catálogo, preenche UM (e deixa o preço vir do lookup). */
export function applyCatalogMaterial(row: ItemRow, material: string): ItemRow {
  const next: ItemRow = { ...row, material }
  const match = findPriceRow(next)
  if (match?.um) next.um = match.um
  return next
}
