import { expect, test } from '@playwright/test'
import { fakeBackend } from './backend'
import { signUp } from './steps'

const DURING = new Date('2026-11-07T11:00:00-03:00')
const AUTHOR = '10000000-0000-4000-8000-0000000000bb'

const row = (n: number, caption: string, at: string) => {
  const id = `01900000-0000-7000-8000-00000000000${n}`
  return {
    id, guest_id: AUTHOR, kind: 'party', caption, frame: 'classic', tilt: 0, test: false, bytes: 1000,
    original_path: `party/${AUTHOR}/${id}.jpg`, preview_path: `party/${AUTHOR}/${id}-p.jpg`, on_r2: false,
    preview_url: null, thumb_url: null, created_at: at, updated_at: at, removed_at: null, faces_status: 'done',
  }
}

test('the stack opens on the newest photo, and newer ones arriving are one tap away', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const rows = [row(2, 'nova', '2026-11-07T13:50:00Z'), row(1, 'antiga', '2026-11-07T13:10:00Z')]
  await fakeBackend(page)
  await page.route(/\/rest\/v1\/photos/, (route) => route.fulfill({ json: rows }))
  await page.clock.install({ time: DURING })
  await signUp(page)
  const top = page.locator('.stack-card', { has: page.locator('.stack-drag') })
  await expect(top).toContainText('nova')
  await expect(page.locator('.feed-new')).toHaveCount(0)

  // someone posts: the card being looked at stays, and a button offers the new one
  rows.unshift(row(3, 'novinha', '2026-11-07T14:01:00Z'))
  await page.clock.fastForward(60_000)
  await expect(page.locator('.feed-new')).toHaveText('1 foto nova ↑', { timeout: 15_000 })
  await expect(top).toContainText('nova')
  await page.locator('.feed-new').click()
  await expect(top).toContainText('novinha')
  await expect(page.locator('.feed-new')).toHaveCount(0)
  expect(errors).toEqual([])
})
