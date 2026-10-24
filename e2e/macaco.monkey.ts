import { expect, test, type Page } from '@playwright/test'
import { fakeBackend } from './backend'
import { cameraPhoto, signUp } from './steps'

// The monkey test: a robot taps, swipes, types, goes back and reloads at random, like a child playing with the
// phone, for MACACO_MS (2 minutes by default). It fails on any page error or a blank screen. Not part of every
// PR: run it with `npm run macaco` or from Actions (it also runs every week). MACACO_SEED repeats a run.
const DURING = new Date('2026-11-07T11:00:00-03:00')
const MS = Number(process.env.MACACO_MS ?? 120_000)
const SEED = Number(process.env.MACACO_SEED ?? Date.now() % 1_000_000)

/** Small seeded random numbers (mulberry32), so a failing run can be repeated with its seed. */
function random(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WORDS = ['oi', 'Ana Souza', '😂🔥', '', '   ', 'a'.repeat(200), '<b>x</b>', "'; drop table", '@perfil', '123456']

test(`monkey: ${MS / 1000}s of random taps (seed ${SEED})`, async ({ page }) => {
  test.setTimeout(MS + 120_000)
  const rnd = random(SEED)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
  const errors: string[] = []
  const log: string[] = []
  page.on('pageerror', (e) => errors.push(`${e.message}\n${e.stack ?? ''}`))
  page.on('dialog', (d) => void d.accept())
  // the camera and the gallery hand over a photo whenever the robot opens them
  const photo = await (async () => {
    await fakeBackend(page)
    await page.clock.install({ time: DURING })
    await page.goto('/')
    return cameraPhoto(page)
  })()
  page.on('filechooser', (f) => void f.setFiles(photo).catch(() => undefined))
  // nothing leaves the test: links to other sites (maps, Instagram) are answered here
  await page.route(/^https?:\/\/(?!localhost)(?![^/]*supabase\.co)/, (r) => r.fulfill({ contentType: 'text/html', body: '<p>fora</p>' }))
  await signUp(page)

  const actions: [number, (p: Page) => Promise<string>][] = [
    [50, async (p) => {
      const els = await p.locator('button:visible, [role=tab]:visible, [role=radio]:visible, a:visible, input[type=checkbox]:visible, label:visible, figure:visible').all()
      if (!els.length) return 'nada pra tocar'
      const el = pick(els)
      const what = ((await el.textContent().catch(() => '')) ?? '').trim().slice(0, 30)
      await el.click({ timeout: 1500, force: rnd() < 0.2 }).catch(() => undefined)
      return `toca "${what}"`
    }],
    [15, async (p) => {
      const v = p.viewportSize()!
      const x = Math.floor(rnd() * v.width)
      const y = Math.floor(rnd() * v.height)
      await p.mouse.click(x, y, { clickCount: rnd() < 0.3 ? 2 : 1 })
      return `toque em ${x},${y}`
    }],
    [10, async (p) => {
      const v = p.viewportSize()!
      const y = v.height * (0.3 + rnd() * 0.4)
      await p.mouse.move(v.width * 0.8, y)
      await p.mouse.down()
      await p.mouse.move(v.width * 0.1, y + (rnd() - 0.5) * 100, { steps: 5 })
      await p.mouse.up()
      return 'arrasta pro lado'
    }],
    [8, async (p) => {
      const els = await p.locator('input:visible:not([type=checkbox]):not([type=file]), textarea:visible').all()
      if (!els.length) return 'nada pra escrever'
      const w = pick(WORDS)
      await pick(els).fill(w, { timeout: 1500 }).catch(() => undefined)
      return `escreve "${w.slice(0, 20)}"`
    }],
    [6, async (p) => {
      // holding the photo while it develops
      const v = p.viewportSize()!
      await p.mouse.move(v.width / 2, v.height / 2)
      await p.mouse.down()
      await p.waitForTimeout(400 + rnd() * 1200)
      await p.mouse.up()
      return 'segura'
    }],
    [7, async (p) => {
      await p.goBack({ timeout: 3000 }).catch(() => undefined)
      return 'voltar do celular'
    }],
    [2, async (p) => {
      await p.reload({ timeout: 15_000 }).catch(() => undefined)
      return 'recarrega'
    }],
    [2, async (p) => {
      await p.clock.fastForward(Math.floor(rnd() * 120_000))
      return 'o tempo passa'
    }],
  ]
  const total = actions.reduce((n, [w]) => n + w, 0)

  const end = Date.now() + MS
  let n = 0
  while (Date.now() < end) {
    let r = rnd() * total
    const [, act] = actions.find(([w]) => (r -= w) < 0) ?? actions[0]
    log.push(await act(page).catch((e) => `falhou: ${String(e).slice(0, 80)}`))
    n++
    // back out of the app entirely (history ran out): open it again, as a guest would
    if (!page.url().startsWith('http://localhost')) {
      await page.goto('/')
      log.push('abre o app de novo')
    }
    const blank = await page.evaluate(() => (document.getElementById('root')?.innerText ?? '').trim().length === 0).catch(() => false)
    if (blank) await page.waitForTimeout(1500)
    const stillBlank = blank && (await page.evaluate(() => (document.getElementById('root')?.innerText ?? '').trim().length === 0).catch(() => false))
    if (errors.length || stillBlank) {
      console.log(`semente ${SEED}, ${n} ações; as últimas:\n  ${log.slice(-15).join('\n  ')}`)
      expect(errors, 'a página deu erro').toEqual([])
      expect(stillBlank, 'tela branca').toBe(false)
    }
  }
  console.log(`semente ${SEED}: ${n} ações sem erro`)
})
