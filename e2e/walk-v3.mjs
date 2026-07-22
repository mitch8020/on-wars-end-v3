import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4174'
const shots = fileURLToPath(new URL('../shots/', import.meta.url))
await mkdir(shots, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})
page.on('pageerror', (error) => errors.push(`page: ${error.message}`))

await page.goto(baseUrl, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${shots}01-setup.png`, fullPage: true })

await page.getByRole('button', { name: 'Convene the table' }).click()
await page.getByRole('button', { name: 'Open cabinet' }).waitFor()
await page.screenshot({ path: `${shots}02-briefing.png`, fullPage: true })

await page.getByRole('button', { name: 'Open cabinet' }).click()
await page.getByRole('heading', { name: 'Choose one national policy' }).waitFor()
await page.screenshot({ path: `${shots}03-cabinet.png`, fullPage: true })

const actionButton = page.locator('.cabinet-actions .action-button')
if (await actionButton.isDisabled()) {
  const partner = page.locator('.target-picker button').first()
  if (await partner.count()) await partner.click()
}
if (await actionButton.isEnabled()) await actionButton.click()
else await page.getByRole('button', { name: /Conserve instead/ }).click()

await page.getByRole('heading', { name: 'Seal your commitment' }).waitFor()
await page.getByRole('button', { name: 'Suggest a fair share' }).click()
await page.screenshot({ path: `${shots}04-crisis.png`, fullPage: true })
await page.getByRole('button', { name: 'Seal commitment' }).click()

await page.getByRole('heading', { name: 'Make one diplomatic move' }).waitFor()
await page.screenshot({ path: `${shots}05-summit.png`, fullPage: true })

for (let turn = 0; turn < 50; turn += 1) {
  if (await page.locator('.ending-communique').isVisible()) break
  if (await page.getByRole('heading', { name: 'Make one diplomatic move' }).isVisible()) {
    const sign = page.getByRole('button', { name: 'Sign the Vellan Accord' })
    if (await sign.isEnabled()) {
      await sign.click()
    } else {
      await page.getByRole('button', { name: 'Backchannel' }).click()
      const backchannel = page.getByRole('button', { name: 'Open backchannel' })
      if (await backchannel.isEnabled()) await backchannel.click()
      else await page.getByRole('button', { name: 'Pass this summit move' }).click()
    }
  } else if (await page.getByRole('heading', { name: 'Choose one national policy' }).isVisible()) {
    const cabinetAction = page.locator('.cabinet-actions .action-button')
    if (await cabinetAction.isDisabled()) {
      const partner = page.locator('.target-picker button').first()
      if (await partner.count()) await partner.click()
    }
    if (await cabinetAction.isEnabled()) await cabinetAction.click()
    else await page.getByRole('button', { name: /Conserve instead/ }).click()
  } else if (await page.getByRole('heading', { name: 'Seal your commitment' }).isVisible()) {
    await page.getByRole('button', { name: 'Suggest a fair share' }).click()
    await page.getByRole('button', { name: 'Seal commitment' }).click()
  } else if (await page.getByRole('button', { name: /Begin round|Read the final outcome/ }).isVisible()) {
    await page.getByRole('button', { name: /Begin round|Read the final outcome/ }).click()
  } else if (await page.getByRole('button', { name: 'Open cabinet' }).isVisible()) {
    await page.getByRole('button', { name: 'Open cabinet' }).click()
  } else {
    break
  }
}
await page.locator('.ending-communique').waitFor()
await page.screenshot({ path: `${shots}06-ending.png`, fullPage: true })

const hotseat = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 })
await hotseat.goto(baseUrl, { waitUntil: 'networkidle' })
await hotseat.evaluate(() => localStorage.clear())
await hotseat.reload({ waitUntil: 'networkidle' })
await hotseat.getByRole('button', { name: /Pass & play/ }).click()
await hotseat.getByRole('button', { name: 'Convene the table' }).click()
await hotseat.getByRole('button', { name: 'Open cabinet' }).click()
await hotseat.getByRole('heading', { name: /Pass the table to/ }).waitFor()
await hotseat.screenshot({ path: `${shots}07-hotseat-curtain.png`, fullPage: true })
await hotseat.getByRole('button', { name: /^I am / }).click()
const hotseatAction = hotseat.locator('.cabinet-actions .action-button')
if (await hotseatAction.isDisabled()) {
  const partner = hotseat.locator('.target-picker button').first()
  if (await partner.count()) await partner.click()
}
if (await hotseatAction.isEnabled()) await hotseatAction.click()
else await hotseat.getByRole('button', { name: /Conserve instead/ }).click()
await hotseat.getByRole('heading', { name: /Pass the table to/ }).waitFor()

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
await mobile.goto(baseUrl, { waitUntil: 'networkidle' })
await mobile.evaluate(() => localStorage.clear())
await mobile.reload({ waitUntil: 'networkidle' })
await mobile.screenshot({ path: `${shots}08-mobile-setup.png`, fullPage: true })
await mobile.getByRole('button', { name: 'Convene the table' }).click()
await mobile.getByRole('button', { name: 'Open cabinet' }).click()
await mobile.getByRole('heading', { name: 'Choose one national policy' }).waitFor()
await mobile.screenshot({ path: `${shots}09-mobile-table.png`, fullPage: true })

await browser.close()
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('walk-v3: solo flow, hotseat privacy, and mobile layouts passed without browser errors')
