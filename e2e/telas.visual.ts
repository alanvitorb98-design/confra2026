import { expect, test, type Page } from '@playwright/test'
import { fakeBackend } from './backend'
import { cameraPhoto } from './steps'

// Pictures of the screens every guest sees, compared with the approved ones in e2e/telas/. A change in the
// look (a font that stopped loading, a button pushed off the screen, a broken color) fails here even when
// every button still works. Runs on every PR (npm run telas). The approved pictures come from CI's own
// browser: Actions › Telas › Run workflow writes them on the branch "telas-aprovadas", merged with a PR.
const DURING = new Date('2026-11-07T11:00:00-03:00')

const look = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(`${name}.png`, { fullPage: false, animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 })

test('the screens a guest goes through look as approved', async ({ page }) => {
  await fakeBackend(page)
  // the clock stands still at the same minute of the party, so countdowns and "há 1 min" never change
  await page.clock.setFixedTime(DURING)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Continuar no navegador' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await look(page, '1-instalar')

  await page.getByRole('button', { name: 'Continuar no navegador' }).click()
  await expect(page.locator('.splash-go')).toBeVisible()
  await look(page, '2-entrada')

  await page.locator('.splash-go').click()
  const terms = page.getByRole('dialog', { name: 'Combinados da festa' })
  await expect(terms).toBeVisible()
  await look(page, '3-combinados')
  await terms.getByLabel('Li e topo os combinados').check()
  await terms.getByRole('button', { name: 'Entrar' }).click()

  await page.getByLabel('Nome e sobrenome').fill('Ana Teste')
  await page.getByLabel('Nome e sobrenome').blur()
  await look(page, '4-cadastro')
  await page.getByRole('button', { name: 'Prefiro marcar na mão' }).click()
  await page.getByRole('button', { name: 'Entrar na festa' }).click()
  await expect(page.getByRole('button', { name: 'Tirar foto' })).toBeVisible({ timeout: 15_000 })
  await look(page, '5-inicio')

  await page.locator('#camera').setInputFiles(await cameraPhoto(page))
  const print = page.locator('.develop-polaroid')
  await expect(page.locator('.develop.stage-develop')).toBeVisible({ timeout: 10_000 })
  const box = (await print.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page.getByText('Revelou!')).toBeVisible({ timeout: 10_000 })
  await page.mouse.up()
  await look(page, '6-revelou')

  await page.getByRole('button', { name: 'Postar no feed' }).click()
  await expect(page.locator('.stack figure').first()).toBeVisible({ timeout: 10_000 })
  await look(page, '7-feed')
})
