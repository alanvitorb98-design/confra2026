import { expect, test, type Page } from '@playwright/test'
import { fakeBackend } from './backend'

// the photo's whole way: sign up during the party, take it, reveal it, post it
const DURING = new Date('2026-11-07T11:00:00-03:00')

/** A small JPEG drawn in the browser, as the camera would hand it over. */
async function cameraPhoto(page: Page) {
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 800
    c.height = 600
    const g = c.getContext('2d')!
    g.fillStyle = '#c84'
    g.fillRect(0, 0, 800, 600)
    g.fillStyle = '#248'
    g.fillRect(200, 150, 400, 300)
    return c.toDataURL('image/jpeg', 0.9).split(',')[1]
  })
  return { name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(data, 'base64') }
}

async function signUp(page: Page) {
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
}

/** Picks a photo as if from the camera, holds it until it develops and posts it. */
async function takeAndPost(page: Page) {
  await page.locator('#camera').setInputFiles(await cameraPhoto(page))
  const print = page.locator('.develop-polaroid')
  await expect(print.locator('img.develop-sharp')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.develop.stage-develop')).toBeVisible({ timeout: 10_000 })
  const box = (await print.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page.getByText('Revelou!')).toBeVisible({ timeout: 10_000 })
  await page.mouse.up()
  await page.getByRole('button', { name: 'Postar no feed' }).click()
}

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
  await expect.poll(() => calls.filter((c) => c.fn === 'join').length).toBe(1)
  fail = false
  await page.getByRole('button', { name: 'Entrar na festa' }).click()
  await expect(page.getByRole('button', { name: 'Tirar foto' })).toBeVisible({ timeout: 15_000 })
  const keys = calls.filter((c) => c.fn === 'join').map((c) => (c.body as { key?: string }).key)
  expect(keys).toHaveLength(2)
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
  expect(keys[1]).toBe(keys[0])
})
