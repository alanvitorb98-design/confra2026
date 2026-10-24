import { expect, type Page } from '@playwright/test'

// Steps several tests share: a guest signing up during the party, and a photo's way from the camera to the feed.

/** A small JPEG drawn in the browser, as the camera would hand it over. */
export async function cameraPhoto(page: Page) {
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

export async function signUp(page: Page) {
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
export async function takeAndPost(page: Page) {
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
