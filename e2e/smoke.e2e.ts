import { expect, test, type Page } from '@playwright/test'
import { event, fakeBackend } from './backend'

// the app's phases follow the phone's clock: tests pin it so they pass on any date
const BEFORE = new Date('2026-10-20T12:00:00-03:00')
const DURING = new Date('2026-11-07T11:00:00-03:00')

// the built site carries a Content-Security-Policy: anything it blocks shows up as a console error
let blocked: string[] = []

test.beforeEach(async ({ page }) => {
  blocked = []
  page.on('console', (m) => {
    if (m.type() === 'error' && m.text().includes('Content Security Policy')) blocked.push(m.text())
  })
  await fakeBackend(page)
  await page.clock.install({ time: BEFORE })
})

/** Install screen, opening screen and the party's terms, as a guest opening the link in the browser. */
async function openInBrowser(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Continuar no navegador' }).click()
  await page.getByRole('button', { name: 'Bora!' }).click()
  const terms = page.getByRole('dialog', { name: 'Combinados da festa' })
  await terms.getByLabel('Li e topo os combinados').check()
  await terms.getByRole('button', { name: 'Entrar' }).click()
}

test.afterEach(() => expect(blocked).toEqual([]))

test('a guest gets from the link to the countdown, after accepting the terms', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /tela inicial/ })).toBeVisible()
  await openInBrowser(page)
  // before the party opens: the countdown, with the organizer entrance
  await expect(page.getByRole('button', { name: 'Sou da organização' })).toBeVisible({ timeout: 15_000 })
  expect(errors).toEqual([])
})

test('the organizer box covers what is behind it', async ({ page }) => {
  await openInBrowser(page)
  await page.getByRole('button', { name: 'Sou da organização' }).click({ timeout: 15_000 })
  const box = page.locator('.cd-test')
  await expect(box).toBeVisible()
  const bg = await box.evaluate((el) => getComputedStyle(el).backgroundColor)
  // fully opaque, so the place button behind it does not show through
  const alpha = bg.startsWith('rgba(') ? Number(bg.slice(bg.lastIndexOf(',') + 1, -1)) : 1
  expect(alpha).toBe(1)
})

test('during the party a new guest gets the sign-up form', async ({ page }) => {
  await page.clock.install({ time: DURING })
  await openInBrowser(page)
  await expect(page.getByRole('button', { name: 'Entrar na festa' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Já me cadastrei em outro celular' })).toBeVisible()
})

test('the countdown shows the map of the party place', async ({ page }) => {
  await fakeBackend(page, { event_public: { ...event, lat: -24.2944475, lng: -53.854665 } })
  // the map comes from OpenStreetMap: answered here so the test stays offline
  await page.route(/openstreetmap\.org\//, (route) => route.fulfill({ contentType: 'text/html', body: '<p>mapa</p>' }))
  await openInBrowser(page)
  await page.getByRole('button', { name: 'Ver o local' }).click({ timeout: 15_000 })
  await expect(page.frameLocator('iframe[title="Mapa do local"]').getByText('mapa')).toBeVisible()
})
