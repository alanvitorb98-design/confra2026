import { expect, test, type Page } from '@playwright/test'
import { fakeBackend } from './backend'
import { signUp, takeAndPost } from './steps'

// Moving around the app the way guests do: tapping tabs fast, the phone's back button, reloading on any
// screen, opening odd links. Nothing may break, freeze on a white screen or throw.
const DURING = new Date('2026-11-07T11:00:00-03:00')

let errors: string[] = []
test.beforeEach(({ page }) => {
  errors = []
  page.on('pageerror', (e) => errors.push(e.stack ?? e.message))
})
test.afterEach(() => expect(errors).toEqual([]))

const tab = (page: Page, name: string) => page.locator('.tabbar').getByRole('button', { name, exact: true })

test('jumping between the tabs, going back and reloading keeps the guest where they were', async ({ page }) => {
  await fakeBackend(page)
  await page.clock.install({ time: DURING })
  await signUp(page)
  // tapping fast, the way a bored guest does
  for (let i = 0; i < 4; i++) for (const name of ['Missões', 'Ranking', 'Eu', 'Feed', 'Eu', 'Missões']) await tab(page, name).click()
  await expect(tab(page, 'Missões')).toHaveAttribute('aria-current', 'true')
  // a reload (or the phone reopening the app) stays on the same tab
  for (const name of ['Missões', 'Ranking', 'Eu']) {
    await tab(page, name).click()
    await page.reload()
    await expect(tab(page, name)).toHaveAttribute('aria-current', 'true', { timeout: 15_000 })
    // and back goes to the feed, not out of the app
    await page.goBack()
    await expect(tab(page, 'Feed')).toHaveAttribute('aria-current', 'true')
  }
  await expect(page.getByRole('button', { name: 'Tirar foto' })).toBeVisible()
})

test('back after many tab changes goes to the feed once, not through every tab again', async ({ page }) => {
  await fakeBackend(page)
  await page.clock.install({ time: DURING })
  await signUp(page)
  for (let i = 0; i < 5; i++) {
    await tab(page, 'Ranking').click()
    await tab(page, 'Eu').click()
  }
  await page.goBack()
  await expect(tab(page, 'Feed')).toHaveAttribute('aria-current', 'true')
  // the app's own steps are all gone: the next back has nothing of the app left to close
  const steps = await page.evaluate(() => history.length)
  await tab(page, 'Eu').click()
  await tab(page, 'Feed').click()
  expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(steps + 1)
})

test('a photo opened full screen closes with back, and a reload there brings the feed back', async ({ page }) => {
  await fakeBackend(page)
  await page.clock.install({ time: DURING })
  await signUp(page)
  await takeAndPost(page)
  const viewer = page.getByRole('dialog', { name: 'Foto em tela cheia' })
  await page.locator('.stack figure').first().click()
  await expect(viewer).toBeVisible({ timeout: 10_000 })
  await page.goBack()
  await expect(viewer).toHaveCount(0)
  await expect(tab(page, 'Feed')).toHaveAttribute('aria-current', 'true')
  await page.locator('.stack figure').first().click()
  await expect(viewer).toBeVisible({ timeout: 10_000 })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Tirar foto' })).toBeVisible({ timeout: 15_000 })
  await expect(viewer).toHaveCount(0)
})

test('the sign-up screens survive back and reload', async ({ page }) => {
  await fakeBackend(page)
  // the app is open for sign-up but the party has not started yet
  await page.clock.install({ time: new Date('2026-11-06T21:00:00-03:00') })
  await page.goto('/')
  await page.getByRole('button', { name: 'Continuar no navegador' }).click()
  await page.locator('.splash-go').click()
  // the terms come back after a reload until they are accepted
  await expect(page.getByRole('dialog', { name: 'Combinados da festa' })).toBeVisible()
  await page.reload()
  await page.locator('.splash-go').click()
  const terms = page.getByRole('dialog', { name: 'Combinados da festa' })
  await terms.getByLabel('Li e topo os combinados').check()
  await terms.getByRole('button', { name: 'Entrar' }).click()
  // the form, the opening screen and back again with the phone's button
  await page.getByLabel('Nome e sobrenome').fill('Ana Teste')
  await page.getByRole('button', { name: 'Voltar pro início (data e local)' }).click({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Ver o local' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Entrar na festa' })).toBeVisible()
  // a reload on the form opens the form again, with no opening screens
  await page.reload()
  await expect(page.getByRole('button', { name: 'Entrar na festa' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.splash-go')).toHaveCount(0)
})

for (const link of ['/?i=xx', '/?i=%3Cscript%3E', '/?c=', '/?c=%22%3E%3Cimg%20src%3Dx%3E', '/?v=ABC', '/?v=AAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '/?agora=2099-01-01T00:00', '/#/qualquer/coisa', '/?i=ACDEFGHJKM&c=FESTA1&v=ABCDEF']) {
  test(`a strange link opens the app normally: ${link}`, async ({ page }) => {
    await fakeBackend(page, { join: () => ({ status: 404, json: { error: 'convite' } }) })
    await page.clock.install({ time: DURING })
    await page.goto(link)
    await page.getByRole('button', { name: 'Continuar no navegador' }).click()
    await page.locator('.splash-go').click()
    const terms = page.getByRole('dialog', { name: 'Combinados da festa' })
    await terms.getByLabel('Li e topo os combinados').check()
    await terms.getByRole('button', { name: 'Entrar' }).click()
    // the sign-up form (or the código de volta), never a white screen
    await expect(page.locator('#name, #back-code, .welcome').first()).toBeVisible({ timeout: 15_000 })
  })
}
