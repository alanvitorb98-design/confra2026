import { expect, test, type Page } from '@playwright/test'
import { event, fakeBackend } from './backend'

// sign-up is open and the party is on
const DURING = new Date('2026-11-07T11:00:00-03:00')
const CARLA = '10000000-0000-4000-8000-0000000000cc'

type Body = Record<string, unknown>

/** Install screen, opening screen and the party's terms, opening the given link in the browser. */
async function open(page: Page, path: string) {
  await page.clock.install({ time: DURING })
  await page.goto(path)
  await page.getByRole('button', { name: 'Continuar no navegador' }).click()
  await page.locator('.splash-go').click()
  const terms = page.getByRole('dialog', { name: 'Combinados da festa' })
  await terms.getByLabel('Li e topo os combinados').check()
  await terms.getByRole('button', { name: 'Entrar' }).click()
}

const joins = (calls: { fn: string; body: unknown }[]) => calls.filter((c) => c.fn === 'join').map((c) => c.body as Body)

test('opening a personal invitation again, the guest picks their name and is back in the same account', async ({ page }) => {
  const calls = await fakeBackend(page, {
    join: (b: Body) =>
      b.peek ? { json: { label: 'Família Souza', seats: 3, people: [{ id: CARLA, name: 'Carla' }] } } : b.as ? { json: { guest_id: CARLA, name: 'Carla' } } : null,
  })
  await open(page, '/?i=ACDEFGHJKM')
  await expect(page.getByText('Família Souza')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Carla' }).click()
  await expect.poll(() => joins(calls).find((b) => b.as)).toMatchObject({ invite: 'ACDEFGHJKM', as: CARLA })
  // the link leaves the address bar: a screenshot or a shared tab does not hand it on
  expect(page.url()).not.toContain('ACDEFGHJKM')
  await expect(page.getByRole('button', { name: 'Entrar na festa' })).toHaveCount(0)
})

test('a family member not on the list yet signs up with the invitation', async ({ page }) => {
  const calls = await fakeBackend(page, {
    join: (b: Body) => (b.peek ? { json: { label: 'Família Souza', seats: 3, people: [{ id: CARLA, name: 'Carla' }] } } : null),
  })
  await open(page, '/?i=ACDEFGHJKM')
  await page.getByRole('button', { name: 'Sou outra pessoa' }).click({ timeout: 15_000 })
  await page.getByLabel('Nome e sobrenome').fill('Davi Souza')
  await page.getByRole('button', { name: 'Prefiro marcar na mão' }).click()
  await page.getByRole('button', { name: 'Entrar na festa' }).click()
  await expect.poll(() => joins(calls).find((b) => b.name)).toMatchObject({ name: 'Davi Souza', invite: 'ACDEFGHJKM' })
})

test('with "só com convite" on, the door asks for the code before the form', async ({ page }) => {
  const calls = await fakeBackend(page, {
    event_public: { ...event, invite_only: true },
    join: (b: Body) => (b.check && b.check !== 'FESTA1' ? { status: 403, json: { error: 'código' } } : null),
  })
  await open(page, '/')
  await expect(page.getByText(/A entrada é só pra convidados/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Entrar na festa' })).toHaveCount(0)

  await page.getByLabel('Código ou link do convite').fill('errado')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText('Esse código não confere. Confere com quem te convidou.')).toBeVisible()

  // a whole link pasted works too
  await page.getByLabel('Código ou link do convite').fill('https://festa.example/?c=festa1')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByLabel('Nome e sobrenome').fill('Ana Lima')
  await page.getByRole('button', { name: 'Prefiro marcar na mão' }).click()
  await page.getByRole('button', { name: 'Entrar na festa' }).click()
  await expect.poll(() => joins(calls).find((b) => b.name)).toMatchObject({ name: 'Ana Lima', code: 'FESTA1' })
})

test('a name already in asks "is it you?" before making a second account', async ({ page }) => {
  const calls = await fakeBackend(page, {
    join: (b: Body) => (b.name && !b.same_name ? { status: 409, json: { error: 'nome' } } : null),
  })
  await open(page, '/')
  await page.getByLabel('Nome e sobrenome').fill('Bia Rocha', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Prefiro marcar na mão' }).click()
  await page.getByRole('button', { name: 'Entrar na festa' }).click()
  await expect(page.getByText(/Já tem alguém chamado Bia Rocha na festa/)).toBeVisible()

  // "it's me" leads to the código de volta
  await page.getByRole('button', { name: 'Sou eu, quero voltar pra minha conta' }).click()
  await expect(page.getByText('Não sabe o código? Peça pra organização mostrar o seu QR de volta.')).toBeVisible()
  await page.getByRole('button', { name: 'Primeira vez aqui' }).click()

  // someone else with the same name goes ahead
  await page.getByRole('button', { name: 'Não, sou outra pessoa' }).click()
  await expect.poll(() => joins(calls).filter((b) => b.name).at(-1)).toMatchObject({ name: 'Bia Rocha', same_name: true })
})

test('a first name alone asks for the surname before entering', async ({ page }) => {
  await fakeBackend(page)
  await open(page, '/')
  await page.getByLabel('Nome e sobrenome').fill('Bia', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Prefiro marcar na mão' }).click()
  await expect(page.getByText('Coloca o sobrenome também')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar na festa' })).toBeDisabled()
  await page.getByLabel('Nome e sobrenome').fill('Bia Rocha')
  await expect(page.getByRole('button', { name: 'Entrar na festa' })).toBeEnabled()
})

test("the organizer's QR de volta signs the phone back in on its own", async ({ page }) => {
  const calls = await fakeBackend(page, { join: (b: Body) => (b.back ? { json: { name: 'Bia' } } : null) })
  await open(page, '/?v=ACD-347')
  await expect.poll(() => joins(calls).find((b) => b.back)).toMatchObject({ back: 'ACD347' })
  expect(page.url()).not.toContain('ACD')
})
