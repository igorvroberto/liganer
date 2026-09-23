#!/usr/bin/env node
/**
 * Wrapper: a fonte canônica no monorepo é scripts/inject-vendas-auth-guard.mjs (raiz).
 * Mantido aqui para compatibilidade com docs/scripts locais deste app.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const rootScript = path.resolve(here, '../../../scripts/inject-vendas-auth-guard.mjs')
const result = spawnSync(process.execPath, [rootScript], {
  stdio: 'inherit',
  cwd: path.resolve(here, '../../..'),
})
process.exit(result.status ?? 1)
