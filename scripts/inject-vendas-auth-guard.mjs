#!/usr/bin/env node
/**
 * Downloads live SPA index.html files from vendas.liganer.com.br and injects
 * /auth/guard.js so sibling apps require the shared login.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ORIGIN = 'https://vendas.liganer.com.br'
const OUT_ROOT = path.resolve('inject-dist')
const GUARD_TAG = '<script src="/auth/guard.js"></script>'

const TARGETS = [
  'prospeccao',
  'orcamento/blanks-slitters',
  'orcamento/ace',
  'comparador-preco',
]

function injectGuard(html) {
  if (html.includes('/auth/guard.js')) return { html, changed: false }
  if (/<\/head>/i.test(html)) {
    return {
      html: html.replace(/<\/head>/i, `    ${GUARD_TAG}\n  </head>`),
      changed: true,
    }
  }
  return {
    html: `${GUARD_TAG}\n${html}`,
    changed: true,
  }
}

async function main() {
  let changedCount = 0
  for (const target of TARGETS) {
    const url = `${ORIGIN}/${target}/`
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) {
      console.warn(`skip ${target}: HTTP ${res.status}`)
      continue
    }
    const original = await res.text()
    const { html, changed } = injectGuard(original)
    const outDir = path.join(OUT_ROOT, target)
    await mkdir(outDir, { recursive: true })
    await writeFile(path.join(outDir, 'index.html'), html, 'utf8')
    console.log(`${changed ? 'patched' : 'already-guarded'}: ${target}/index.html`)
    if (changed) changedCount += 1
  }
  console.log(`done; files ready under ${OUT_ROOT} (${changedCount} patched)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
