import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4174'
const shots = resolve(process.env.SHOTS_DIR || fileURLToPath(new URL('../shots/', import.meta.url)))
await mkdir(shots, { recursive: true })

const browser = await chromium.launch({ headless: true })
const errors = []

async function checkedPage(label, options) {
  const page = await browser.newPage(options)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`${label} page: ${error.message}`))
  return page
}

async function resetSetup(page, seed = 148802) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.seed-field input').fill(String(seed))
}

const page = await checkedPage('solo', {
  viewport: { width: 1600, height: 1050 },
  deviceScaleFactor: 1,
})
await resetSetup(page)
await page.screenshot({ path: join(shots, '01-setup.png'), fullPage: true })

await page.getByRole('button', { name: 'Convene the table' }).click()
await page.getByRole('button', { name: 'Open cabinet' }).waitFor()
await page.screenshot({ path: join(shots, '02-briefing.png'), fullPage: true })

await page.getByRole('button', { name: 'Open cabinet' }).click()
await page.getByRole('heading', { name: 'Choose one national policy' }).waitFor()
await page.screenshot({ path: join(shots, '03-cabinet.png'), fullPage: true })

const actionButton = page.locator('.cabinet-actions .action-button')
if (await actionButton.isDisabled()) {
  const partner = page.locator('.target-picker button').first()
  if (await partner.count()) await partner.click()
}
if (await actionButton.isEnabled()) await actionButton.click()
else await page.getByRole('button', { name: /Conserve instead/ }).click()

await page.getByRole('heading', { name: 'Seal your commitment' }).waitFor()
await page.getByRole('button', { name: 'Suggest a fair share' }).click()
await page.screenshot({ path: join(shots, '04-crisis.png'), fullPage: true })
await page.getByRole('button', { name: 'Seal commitment' }).click()

await page.getByRole('heading', { name: 'Make one diplomatic move' }).waitFor()
await page.screenshot({ path: join(shots, '05-summit.png'), fullPage: true })
await page.getByRole('button', { name: 'Exchange' }).click()
await page.getByRole('button', { name: 'Post proposal' }).waitFor()
await page.getByRole('button', { name: 'Backchannel' }).click()
await page.getByRole('button', { name: 'Open backchannel' }).waitFor()
await page.getByRole('button', { name: 'Accord' }).click()
await page.getByRole('button', { name: 'Sign the Vellan Accord' }).waitFor()

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
await page.screenshot({ path: join(shots, '06-ending.png'), fullPage: true })

const resume = await checkedPage('resume', {
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 1,
})
await resetSetup(resume)
await resume.getByRole('button', { name: 'Convene the table' }).click()
await resume.getByRole('button', { name: 'Open cabinet' }).click()
await resume.getByRole('heading', { name: 'Choose one national policy' }).waitFor()
await resume.reload({ waitUntil: 'networkidle' })
await resume.getByRole('button', { name: 'Resume table' }).click()
await resume.getByRole('heading', { name: 'Choose one national policy' }).waitFor()
await resume.close()

const hotseat = await checkedPage('hotseat', {
  viewport: { width: 1440, height: 950 },
  deviceScaleFactor: 1,
})
await resetSetup(hotseat)
await hotseat.getByRole('button', { name: /Pass & play/ }).click()
await hotseat.getByRole('button', { name: 'Convene the table' }).click()
await hotseat.getByRole('button', { name: 'Open cabinet' }).click()
await hotseat.getByRole('heading', { name: /Pass the table to/ }).waitFor()
await hotseat.screenshot({ path: join(shots, '07-hotseat-curtain.png'), fullPage: true })
await hotseat.getByRole('button', { name: /^I am / }).click()
const hotseatAction = hotseat.locator('.cabinet-actions .action-button')
if (await hotseatAction.isDisabled()) {
  const partner = hotseat.locator('.target-picker button').first()
  if (await partner.count()) await partner.click()
}
if (await hotseatAction.isEnabled()) await hotseatAction.click()
else await hotseat.getByRole('button', { name: /Conserve instead/ }).click()
await hotseat.getByRole('heading', { name: /Pass the table to/ }).waitFor()

const mobile = await checkedPage('mobile', {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
})
await resetSetup(mobile)
await mobile.screenshot({ path: join(shots, '08-mobile-setup.png'), fullPage: true })
await mobile.getByRole('button', { name: 'Convene the table' }).click()
await mobile.getByRole('button', { name: 'Open cabinet' }).click()
await mobile.getByRole('heading', { name: 'Choose one national policy' }).waitFor()
await mobile.screenshot({ path: join(shots, '09-mobile-table.png'), fullPage: true })

await browser.close()
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('walk-v3: solo flow, saved resume, hotseat privacy, and mobile layouts passed without browser errors')
