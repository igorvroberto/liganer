import { chromium } from 'playwright'
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = '/opt/cursor/artifacts'
mkdirSync(OUT, { recursive: true })
const VIDEO_DIR = '/tmp/comparador-ui-video'
mkdirSync(VIDEO_DIR, { recursive: true })

async function main() {
  // Playwright is optional / may not be installed — use dynamic import via createRequire if needed.
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5173/comparador-preco/', { waitUntil: 'networkidle' })

  // Clear leftover drafts
  await page.evaluate(() => {
    localStorage.removeItem('liganer-comparador-preco-draft-v1')
    localStorage.removeItem('liganer-comparador-preco-saved-v1')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.evaluate(() => { localStorage.removeItem('liganer-comparador-preco-draft-v1'); localStorage.removeItem('liganer-comparador-preco-saved-v1'); })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  // 1) No subtitle
  const ledeCount = await page.locator('.lede').count()
  console.log('lede count (expect 0):', ledeCount)

  // 2) No Referência column
  const refHeader = await page.getByRole('columnheader', { name: /Referência/i }).count()
  console.log('referencia headers (expect 0):', refHeader)

  // 3) Decimal comma display on preço cliente
  const price1 = page.locator('tbody tr').nth(0).locator('input[aria-label^="Preço cliente"]')
  const shown = await price1.inputValue()
  console.log('preço cliente display:', shown)

  await page.getByPlaceholder('Nome do cliente').fill('Metalúrgica Demo LTDA')
  await price1.fill('14,50')
  await price1.blur()
  await page.waitForTimeout(300)
  const diff1 = await page.locator('tbody tr').nth(0).locator('td.formula-cell').nth(2).innerText()
  console.log('diferença após 14,50:', diff1)

  // preço fator 100 with comma
  await page.locator('.table-scroll').evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })
  const factor100 = page.locator('tbody tr').nth(0).locator('input[aria-label^="Preço fator 100"]')
  const factorShown = await factor100.inputValue()
  console.log('preço fator 100 display:', factorShown)
  await factor100.fill('26,0781')
  await factor100.blur()
  await page.waitForTimeout(200)

  await page.locator('.table-scroll').evaluate((el) => {
    el.scrollLeft = 0
  })

  // 4) Save + PDF button in list
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.waitForTimeout(400)
  const savedRow = page.locator('.saved-budgets-table tbody tr').first()
  await savedRow.waitFor({ state: 'visible' })
  console.log('saved name:', await savedRow.locator('td').nth(0).innerText())
  console.log('saved client:', await savedRow.locator('td').nth(1).innerText())

  const pdfBtn = savedRow.getByRole('button', { name: 'PDF' })
  await pdfBtn.waitFor({ state: 'visible' })
  console.log('PDF button visible: true')

  // Popup PDF
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    pdfBtn.click(),
  ])
  await popup.waitForLoadState('domcontentloaded')
  const pdfTitle = await popup.title()
  console.log('pdf title:', pdfTitle)
  await popup.close()

  await page.screenshot({ path: `${OUT}/comparador-ui-after-save.png`, fullPage: true })
  await context.close()
  await browser.close()

  const videos = readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'))
  if (videos.length) {
    copyFileSync(join(VIDEO_DIR, videos[0]), join(OUT, 'comparador-ui-save-pdf.webm'))
    console.log('video saved')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
