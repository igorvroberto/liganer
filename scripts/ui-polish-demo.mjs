import { chromium } from 'playwright'
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = '/opt/cursor/artifacts'
mkdirSync(OUT, { recursive: true })
const VIDEO_DIR = '/tmp/comparador-polish-video'
mkdirSync(VIDEO_DIR, { recursive: true })

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5173/comparador-preco/', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.removeItem('liganer-comparador-preco-draft-v1')
    localStorage.removeItem('liganer-comparador-preco-saved-v1')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Recarregar exemplo' }).click()
  await page.waitForTimeout(300)

  // Observações gone
  console.log('observacoes labels:', await page.getByText('Observações', { exact: true }).count())
  // Salvar only after items (inside table-card)
  const saveInClient = await page.locator('section.card').filter({ hasText: 'Cliente e parâmetros' }).getByRole('button', { name: 'Salvar' }).count()
  const saveInItems = await page.locator('section.card').filter({ hasText: /^Itens/ }).getByRole('button', { name: /^Salvar$|^Atualizar/ }).count()
  console.log('salvar in client section:', saveInClient, 'in items:', saveInItems)

  // KPI only 2 after items
  console.log('itens kpi label:', await page.getByText('Itens', { exact: true }).count())
  console.log('com comparacao label:', await page.getByText('Com comparação', { exact: true }).count())
  console.log('diferenca media:', await page.getByText('Diferença média', { exact: true }).count())

  // Fator header (not Fator utilizado)
  console.log('fator utilizado header:', await page.getByRole('columnheader', { name: /Fator\s*utilizado/i }).count())
  console.log('fator header:', await page.getByRole('columnheader', { name: /^Fator$/i }).count())

  // Delete button first column
  const firstCell = page.locator('tbody tr').first().locator('td').first()
  console.log('first cell has trash:', await firstCell.locator('.trash-button').count())

  // PIS with comma
  const pis = page.getByLabel('PIS + COFINS em percentual')
  await pis.fill('9,25')
  await pis.blur()
  console.log('pis display:', await pis.inputValue())

  await page.getByPlaceholder('Nome do cliente').fill('Cliente Polish')
  await page.locator('section.card').filter({ hasText: /^Itens/ }).getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.waitForTimeout(300)

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('.saved-budgets-table').getByRole('button', { name: 'PDF' }).first().click(),
  ])
  await popup.waitForLoadState('domcontentloaded')
  const pdfHtml = await popup.content()
  console.log('pdf has PIS:', /PIS\s*\+\s*COFINS/i.test(pdfHtml))
  console.log('pdf has Observações:', /Observações/i.test(pdfHtml))
  console.log('pdf has Preço fator 100:', /Preço fator 100/i.test(pdfHtml))
  console.log('pdf has Diferença média:', /Diferença média/i.test(pdfHtml))
  console.log('pdf has Acima / abaixo:', /Acima\s*\/\s*abaixo/i.test(pdfHtml))
  await popup.close()

  await page.screenshot({ path: `${OUT}/comparador-polish-ui.png`, fullPage: true })
  await context.close()
  await browser.close()

  const videos = readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'))
  if (videos.length) {
    copyFileSync(join(VIDEO_DIR, videos[0]), join(OUT, 'comparador-polish-ui.webm'))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
