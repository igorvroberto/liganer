#!/usr/bin/env node
/**
 * Regenera o JSON de fallback a partir da planilha ACE:
 *   https://vendas.liganer.com.br/orcamento/tabelas/precos-ace.xlsx
 *
 * Se o download falhar (offline), usa `legado/precos-ace.xlsx`.
 *
 * A planilha NÃO é publicada com este app — fica em /orcamento/tabelas/.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHARED_URL = 'https://vendas.liganer.com.br/orcamento/tabelas/precos-ace.xlsx'
const legadoCandidates = [resolve(root, 'legado/precos-ace.xlsx')]
const publicXlsxLegacy = resolve(root, 'public/precos-bobinas-chapas.xlsx')
const jsonOut = resolve(root, 'src/data/precos-ace.json')
const oldJson = resolve(root, 'src/data/precos-bobinas-chapas.json')

function numericValue(value) {
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

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function roundPrice(value) {
  const n = numericValue(value)
  return n ? Math.round(n * 1e6) / 1e6 : 0
}

function findHeaderColumn(headers, aliases) {
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

function looksLikeNamedHeader(headers) {
  const joined = headers.join(' ')
  return (
    joined.includes('material') ||
    joined.includes('descricao') ||
    joined.includes('produto') ||
    joined.includes('preco') ||
    joined.includes('um')
  )
}

function looksLikePlaceholderHeader(headers) {
  return headers.some((h) => /^column\d+$/i.test(h) || /^col(una)?\s*\d+$/i.test(h))
}

function rowFromCells(codigo, material, um, preco, estoque, valor, icms) {
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

function parseWorkbookBuffer(buffer) {
  const book = XLSX.read(buffer, { type: 'buffer' })
  const sheet = book.Sheets[book.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
  if (!matrix.length) return []

  const headers = (matrix[0] || []).map(normalizeHeader)
  const named = looksLikeNamedHeader(headers) && !looksLikePlaceholderHeader(headers)
  const rows = []

  if (named) {
    const colMaterial = findHeaderColumn(headers, ['material', 'descricao', 'produto', 'item'])
    const colUm = findHeaderColumn(headers, ['um', 'unidade', 'unidade medida'])
    const colPreco = findHeaderColumn(headers, ['preco', 'preço', 'preco fator 100', 'valor unitario'])
    const colCodigo = findHeaderColumn(headers, ['codigo', 'código', 'cod', 'sku', 'id'])
    const colEstoque = findHeaderColumn(headers, ['estoque', 'saldo', 'qtd estoque'])
    const colValor = findHeaderColumn(headers, ['valor', 'valor total'])
    const colIcms = findHeaderColumn(headers, ['icms'])
    if (colMaterial < 0) return []
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
    return rows
  }

  const start = looksLikePlaceholderHeader(headers) ? 1 : 0
  for (let r = start; r < matrix.length; r += 1) {
    const line = matrix[r] || []
    const parsed = rowFromCells(line[0], line[1], line[2], line[3], line[4], line[5], 0)
    if (parsed) rows.push(parsed)
  }
  return rows
}

async function loadWorkbook() {
  try {
    const response = await fetch(SHARED_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    return { buffer, source: SHARED_URL }
  } catch (error) {
    const local = legadoCandidates.find((path) => existsSync(path))
    if (!local) {
      console.error(
        'Não foi possível baixar a planilha compartilhada e nenhum arquivo local foi encontrado.',
      )
      console.error('URL:', SHARED_URL)
      console.error('Erro:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
    console.warn(
      `Aviso: download falhou (${error instanceof Error ? error.message : error}). Usando ${local}`,
    )
    return { buffer: readFileSync(local), source: local.replace(`${root}/`, '') }
  }
}

const { buffer, source } = await loadWorkbook()
const rows = parseWorkbookBuffer(buffer)
if (!rows.length) {
  console.error('Planilha sem linhas válidas:', source)
  process.exit(1)
}

mkdirSync(dirname(jsonOut), { recursive: true })
writeFileSync(jsonOut, `${JSON.stringify({ source, rows }, null, 2)}\n`, 'utf8')

if (existsSync(oldJson)) {
  unlinkSync(oldJson)
  console.log('Removido: src/data/precos-bobinas-chapas.json')
}
if (existsSync(publicXlsxLegacy)) {
  unlinkSync(publicXlsxLegacy)
  console.log('Removido: public/precos-bobinas-chapas.xlsx')
}

console.log(`OK: ${rows.length} linhas de ${source} → src/data/precos-ace.json`)
