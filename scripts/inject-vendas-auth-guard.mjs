#!/usr/bin/env node
/**
 * Verifica se os SPAs em vendas.liganer.com.br já carregam /auth/guard.js.
 *
 * NÃO grava nem faz upload de index.html. O deploy do root-index não deve
 * republicar indexes dos SPAs (race: HTML antigo + JS novo apagado → blank).
 * O guard é embutido no index de cada app no build.
 *
 * Uso manual: node scripts/inject-vendas-auth-guard.mjs
 */
const ORIGIN = 'https://vendas.liganer.com.br'
const GUARD_NEEDLE = '/auth/guard.js'

const TARGETS = [
  'prospeccao',
  'orcamento/blanks-slitters',
  'orcamento/ace',
  'orcamento/chapas-bobinas',
  'comparador-preco',
]

async function main() {
  let missing = 0
  for (const target of TARGETS) {
    const url = `${ORIGIN}/${target}/`
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) {
      console.warn(`skip ${target}: HTTP ${res.status}`)
      missing += 1
      continue
    }
    const html = await res.text()
    if (html.includes(GUARD_NEEDLE)) {
      console.log(`ok: ${target}/ (guard present)`)
    } else {
      console.error(`missing guard: ${target}/`)
      missing += 1
    }
  }
  if (missing > 0) {
    console.error(
      `fail: ${missing} target(s) without guard — embuta <script src="/auth/guard.js"> no index do SPA e redeploy.`,
    )
    process.exit(1)
  }
  console.log('done; all targets have guard.js')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
