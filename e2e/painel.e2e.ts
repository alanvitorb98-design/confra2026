import { expect, test } from '@playwright/test'
import { event, fakeBackend } from './backend'
import { signUp } from './steps'

const DURING = new Date('2026-11-07T11:00:00-03:00')

test('an organizer turns on the health alerts from the panel', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await fakeBackend(page, { is_admin: true })
  // the panel reads the settings straight from the table
  await page.route(/\/rest\/v1\/event_config/, (route) => route.fulfill({ json: { ...event, invite_only: false } }))
  await page.context().grantPermissions(['notifications'])
  // the CI browser may lack web push: give it the bare minimum so the panel offers the button
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    if (!('Notification' in w)) w.Notification = { permission: 'default', requestPermission: async () => 'default' }
    if (!('PushManager' in w)) w.PushManager = function PushManager() {}
    if (!('serviceWorker' in navigator)) Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration: async () => undefined } })
  })
  await page.clock.install({ time: DURING })
  await signUp(page)
  await page.locator('.tabbar').getByRole('button', { name: 'Eu', exact: true }).click()
  await page.getByRole('button', { name: 'Painel do organizador' }).click()
  const alerts = page.locator('section', { has: page.getByRole('heading', { name: 'Alertas de saúde' }) })
  await expect(alerts).toBeVisible()
  await expect(alerts.getByRole('button', { name: 'Ligar alertas' })).toBeVisible()
  expect(errors).toEqual([])
})
