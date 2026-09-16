import { chromium } from 'playwright'
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = '/opt/cursor/artifacts'
mkdirSync(OUT, { recursive: true })
const VIDEO_DIR = '/tmp/comparador-pw-video'
mkdirSync(VIDEO_DIR, { recursive: true })

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5173/comparador-preco/', { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: 'Recarregar exemplo' }).click()
  await page.waitForTimeout(600)

  await page.getByPlaceholder('Nome do cliente').click()
  await page.getByPlaceholder('Nome do cliente').fill('Metalúrgica Demo LTDA')
  await page.waitForTimeout(400)

  await page.locator('tbody tr').nth(0).locator('input[aria-label^="Concorrente"]').fill('Concorrente Alpha')
  await page.waitForTimeout(400)

  const row1Price = page.locator('tbody tr').nth(0).locator('input[aria-label^="Preço cliente"]')
  await row1Price.fill('')
  await row1Price.fill('14,50')
  await row1Price.blur()
  await page.waitForTimeout(800)

  await page.getByRole('button', { name: '+ Item' }).click()
  await page.waitForTimeout(500)

  const row7 = page.locator('tbody tr').nth(6)
  await row7.locator('input[aria-label^="Nosso produto"]').fill('TUBO DEMO TESTE')
  await row7.locator('input[aria-label^="Fator utilizado"]').fill('100')
  await row7.locator('input[aria-label^="Preço cliente"]').fill('40')
  await page.locator('.table-scroll').evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })
  await page.waitForTimeout(300)
  await row7.locator('input[aria-label^="Preço fator 100"]').fill('50')
  await row7.locator('input[aria-label^="Preço fator 100"]').blur()
  await page.waitForTimeout(500)

  await page.locator('.table-scroll').evaluate((el) => {
    el.scrollLeft = 500
  })
  await page.waitForTimeout(1200)

  await context.close()
  await browser.close()

  const videos = readdirSync(VIDEO_DIR).filter((f) => f.endsWith('.webm'))
  if (!videos.length) throw new Error('No video recorded')
  const src = join(VIDEO_DIR, videos[0])
  const dest = join(OUT, 'comparador-hello-world.webm')
  copyFileSync(src, dest)
  console.log('video saved:', dest)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
