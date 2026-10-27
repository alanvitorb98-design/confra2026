import { expect, test, type Route } from '@playwright/test'
import { event, fakeBackend } from './backend'
import { cameraPhoto, signUp, takeAndPost } from './steps'

// the photo's whole way: sign up during the party, take it, reveal it, post it
const DURING = new Date('2026-11-07T11:00:00-03:00')

test('a photo taken during the party is uploaded and published once', async ({ page }) => {
  const calls = await fakeBackend(page)
  await page.clock.install({ time: DURING })
  await signUp(page)
  await takeAndPost(page)
  await expect.poll(() => calls.filter((c) => c.fn === 'send_photo').length, { timeout: 15_000 }).toBe(1)
  const sent = calls.find((c) => c.fn === 'send_photo')!.body as { p_original: string; p_preview: string; p_kind: string }
  expect(sent.p_kind).toBe('party')
  // the original, the 1080px copy and the thumbnail all went up before the photo was published
  const uploads = calls.filter((c) => c.fn === 'upload').map((c) => c.body as string)
  expect(uploads.some((u) => u.endsWith(sent.p_original))).toBe(true)
  expect(uploads.some((u) => u.endsWith(sent.p_preview))).toBe(true)
  expect(uploads.some((u) => u.endsWith(sent.p_preview.replace(/-p\.jpg$/, '-t.jpg')))).toBe(true)
})

test("a phone whose clock is two hours ahead follows the server's time", async ({ page }) => {
  const serverNow = new Date('2026-11-07T19:00:00-03:00')
  const calls = await fakeBackend(page, { event_public: { ...event, now: serverNow.toISOString() } })
  // on its own clock the party ended an hour ago
  await page.clock.install({ time: new Date('2026-11-07T21:00:00-03:00') })
  await signUp(page)
  await takeAndPost(page)
  await expect.poll(() => calls.filter((c) => c.fn === 'send_photo').length, { timeout: 15_000 }).toBe(1)
  // the photo carries the moment it was taken on the server's clock (the server refuses one from the future)
  const id = (calls.find((c) => c.fn === 'send_photo')!.body as { p_id: string }).p_id
  const taken = parseInt(id.replace(/-/g, '').slice(0, 12), 16)
  expect(Math.abs(taken - serverNow.getTime())).toBeLessThan(5 * 60_000)
})

test('a photo that fails to publish stays on the phone and goes out after the app reopens', async ({ page }) => {
  let fail = true
  const calls = await fakeBackend(page, { send_photo: () => (fail ? { status: 500 } : null) })
  await page.clock.install({ time: DURING })
  await signUp(page)
  await takeAndPost(page)
  await expect.poll(() => calls.filter((c) => c.fn === 'send_photo').length, { timeout: 15_000 }).toBeGreaterThan(0)
  const id = (calls.find((c) => c.fn === 'send_photo')!.body as { p_id: string }).p_id
  // the server is back; the guest closes and opens the app
  fail = false
  await page.reload()
  // a returning guest opens straight into the app: no install screen or opening screen again
  await expect(page.getByRole('button', { name: 'Continuar no navegador' })).toHaveCount(0)
  await expect(page.locator('.splash-go')).toHaveCount(0)
  await expect
    .poll(() => calls.filter((c) => c.fn === 'send_photo' && (c.body as { p_id: string }).p_id === id).length, { timeout: 20_000 })
    .toBeGreaterThan(1)
  // the same photo id both times: the server keeps one copy
  const ids = new Set(calls.filter((c) => c.fn === 'send_photo').map((c) => (c.body as { p_id: string }).p_id))
  expect(ids.size).toBe(1)
})

test('without internet the photo says it is kept on the phone, and goes once the signal is back', async ({ page, context }) => {
  const calls = await fakeBackend(page)
  await page.clock.install({ time: DURING })
  await signUp(page)
  // the phone loses signal: every request fails before reaching a server
  const cut = (route: Route) => route.abort('internetdisconnected')
  await page.route(/supabase\.co\//, cut)
  await context.setOffline(true)
  await takeAndPost(page)
  await expect(page.getByText('Guardada no celular. Sobe sozinha quando a internet voltar.')).toBeVisible({ timeout: 15_000 })
  expect(calls.filter((c) => c.fn === 'send_photo')).toHaveLength(0)
  await page.unroute(/supabase\.co\//, cut)
  await context.setOffline(false)
  await expect.poll(() => calls.filter((c) => c.fn === 'send_photo').length, { timeout: 20_000 }).toBe(1)
  await expect(page.getByText('Guardada no celular. Sobe sozinha quando a internet voltar.')).toHaveCount(0)
})

test('a photo still developing comes back after the app closes, and is gone once discarded', async ({ page }) => {
  const calls = await fakeBackend(page)
  await page.clock.install({ time: DURING })
  await signUp(page)
  await page.locator('#camera').setInputFiles(await cameraPhoto(page))
  await expect(page.locator('.develop-polaroid img.develop-sharp')).toBeVisible({ timeout: 10_000 })
  // the phone drops the app in the background while the guest answers a message
  await page.reload()
  await expect(page.locator('.develop-polaroid img.develop-sharp')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.locator('.develop-polaroid')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Tirar foto' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.develop-polaroid')).toHaveCount(0)
  expect(calls.filter((c) => c.fn === 'send_photo')).toHaveLength(0)
})

test('a posted photo does not come back on the developing screen', async ({ page }) => {
  const calls = await fakeBackend(page)
  await page.clock.install({ time: DURING })
  await signUp(page)
  await takeAndPost(page)
  await expect.poll(() => calls.filter((c) => c.fn === 'send_photo').length, { timeout: 15_000 }).toBe(1)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Tirar foto' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.develop-polaroid')).toHaveCount(0)
})

test("the organizer's switches pause recognition and hide the missions and ranking tabs", async ({ page }) => {
  const calls = await fakeBackend(page, { event_public: { ...event, faces_on: false, missions_on: false, ranking_on: false } })
  await page.clock.install({ time: DURING })
  await page.goto('/')
  await page.getByRole('button', { name: 'Continuar no navegador' }).click()
  await page.locator('.splash-go').click()
  const terms = page.getByRole('dialog', { name: 'Combinados da festa' })
  await terms.getByLabel('Li e topo os combinados').check()
  await terms.getByRole('button', { name: 'Entrar' }).click()
  await page.getByLabel('Nome e sobrenome').fill('Ana Teste')
  // recognition paused: nobody is asked for a selfie
  await expect(page.getByRole('button', { name: 'Topo!' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Entrar na festa' }).click()
  await expect(page.getByRole('button', { name: 'Tirar foto' })).toBeVisible({ timeout: 15_000 })
  expect((calls.find((c) => c.fn === 'join')!.body as { face?: boolean }).face).toBe(false)
  const tabs = page.locator('.tabbar')
  await expect(tabs.getByRole('button', { name: 'Missões' })).toBeHidden()
  await expect(tabs.getByRole('button', { name: 'Ranking' })).toBeHidden()
  await expect(tabs.getByRole('button', { name: 'Eu' })).toBeVisible()
})

test('the back button closes what is on top instead of leaving the app', async ({ page }) => {
  await fakeBackend(page)
  await page.clock.install({ time: DURING })
  await signUp(page)
  const feedTab = page.locator('.tabbar').getByRole('button', { name: 'Feed' })
  // from another tab, back goes to the feed
  await page.locator('.tabbar').getByRole('button', { name: 'Ranking' }).click()
  await expect(feedTab).not.toHaveAttribute('aria-current', 'true')
  await page.goBack()
  await expect(feedTab).toHaveAttribute('aria-current', 'true')
  // a photo not posted yet stays on screen: back must not lose it
  await page.locator('#camera').setInputFiles(await cameraPhoto(page))
  await expect(page.locator('.develop-polaroid')).toBeVisible({ timeout: 10_000 })
  await page.goBack()
  await expect(page.locator('.develop-polaroid')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tirar foto' })).toBeAttached()
})

test('tapping "Entrar" again after a lost answer signs into the same guest', async ({ page }) => {
  let fail = true
  const calls = await fakeBackend(page, { join: () => (fail ? { status: 500 } : null) })
  await page.clock.install({ time: DURING })
  await page.goto('/')
  await page.getByRole('button', { name: 'Continuar no navegador' }).click()
  await page.locator('.splash-go').click()
  const terms = page.getByRole('dialog', { name: 'Combinados da festa' })
  await terms.getByLabel('Li e topo os combinados').check()
  await terms.getByRole('button', { name: 'Entrar' }).click()
  await page.getByLabel('Nome e sobrenome').fill('Ana Teste')
  await page.getByRole('button', { name: 'Prefiro marcar na mão' }).click()
  await page.getByRole('button', { name: 'Entrar na festa' }).click()
  // the app tries 3 times on its own before giving up
  await expect.poll(() => calls.filter((c) => c.fn === 'join').length, { timeout: 15_000 }).toBe(3)
  fail = false
  await page.getByRole('button', { name: 'Entrar na festa' }).click()
  await expect(page.getByRole('button', { name: 'Tirar foto' })).toBeVisible({ timeout: 15_000 })
  const keys = calls.filter((c) => c.fn === 'join').map((c) => (c.body as { key?: string }).key)
  expect(keys).toHaveLength(4)
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
  expect(new Set(keys).size).toBe(1)
})

test('when the server is still starting up (503), the app tries again by itself', async ({ page }) => {
  let tries = 0
  const calls = await fakeBackend(page, { join: () => (++tries === 1 ? { status: 503, json: { code: 'BOOT_ERROR' } } : null) })
  await page.clock.install({ time: DURING })
  await page.goto('/')
  await page.getByRole('button', { name: 'Continuar no navegador' }).click()
  await page.locator('.splash-go').click()
  const terms = page.getByRole('dialog', { name: 'Combinados da festa' })
  await terms.getByLabel('Li e topo os combinados').check()
  await terms.getByRole('button', { name: 'Entrar' }).click()
  await page.getByLabel('Nome e sobrenome').fill('Ana Teste')
  await page.getByRole('button', { name: 'Prefiro marcar na mão' }).click()
  await page.getByRole('button', { name: 'Entrar na festa' }).click()
  await expect(page.getByRole('button', { name: 'Tirar foto' })).toBeVisible({ timeout: 15_000 })
  expect(calls.filter((c) => c.fn === 'join')).toHaveLength(2)
})
