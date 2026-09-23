import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/opt/cursor/artifacts'
mkdirSync(OUT, { recursive: true })

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://127.0.0.1:5173/comparador-preco/', { waitUntil: 'networkidle' })

  // Reset draft from previous broken session
  await page.evaluate(() => { localStorage.removeItem('liganer-comparador-preco-draft-v1'); localStorage.removeItem('liganer-comparador-preco-saved-v1'); })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  await page.screenshot({ path: `${OUT}/comparador-01-inicial.png`, fullPage: true })

  await page.getByPlaceholder('Nome do cliente').fill('Metalúrgica Demo LTDA')

  const row1Competitor = page.locator('tbody tr').nth(0).locator('input[aria-label^="Concorrente"]')
  await row1Competitor.fill('Concorrente Alpha')

  const row1Price = page.locator('tbody tr').nth(0).locator('input[aria-label^="Preço cliente"]')
  await row1Price.fill('14,50')
  await row1Price.blur()
  await page.waitForTimeout(300)

  const row1Diff = await page.locator('tbody tr').nth(0).locator('.calculated-cell').nth(2).textContent()
  console.log('row1 diferença after price change:', row1Diff)

  await page.getByRole('button', { name: '+ Item' }).click()
  await page.waitForTimeout(200)

  const row7 = page.locator('tbody tr').nth(6)
  await row7.locator('input[aria-label^="Nosso produto"]').fill('TUBO DEMO TESTE')
  await row7.locator('input[aria-label^="Fator utilizado"]').fill('100')
  await row7.locator('input[aria-label^="Preço cliente"]').fill('40')

  // Scroll table to reveal preço fator 100
  await page.locator('.table-scroll').evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })
  await row7.locator('input[aria-label^="Preço fator 100"]').fill('50')
  await row7.locator('input[aria-label^="Preço fator 100"]').blur()
  await page.waitForTimeout(300)

  // Scroll back a bit to show calc columns + factor
  await page.locator('.table-scroll').evaluate((el) => {
    el.scrollLeft = 600
  })
  await page.waitForTimeout(200)

  const row7Our = await row7.locator('td.formula-cell').nth(0).innerText()
  const row7Diff = await row7.locator('td.formula-cell').nth(2).innerText()
  const kpis = await page.locator('.summary-item strong').allInnerTexts()
  console.log('row7 nosso preço:', row7Our)
  console.log('row7 diferença:', row7Diff)
  console.log('kpis:', kpis)

  await page.screenshot({ path: `${OUT}/comparador-02-hello-world.png`, fullPage: true })

  // Focus left side for a clean summary shot
  await page.locator('.table-scroll').evaluate((el) => {
    el.scrollLeft = 0
  })
  await page.screenshot({ path: `${OUT}/comparador-03-resumo.png`, fullPage: false })

  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
