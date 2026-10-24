import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// the phone's storage, as the browser has it
const saved = new Map<string, string>()
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => void saved.set(k, v),
    removeItem: (k: string) => void saved.delete(k),
  })
})

// event.ts reads the saved difference when it loads: each test gets a fresh copy
const load = async () => {
  vi.resetModules()
  return import('../event')
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  saved.clear()
})

describe("the server's clock", () => {
  it('a phone ten minutes ahead counts on the server time', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T20:10:00Z'), toFake: ['Date'] })
    const e = await load()
    e.serverSaid('2026-11-07T20:00:00Z', Date.now() - 200, Date.now())
    expect(Math.abs(e.now() - Date.parse('2026-11-07T20:00:00Z'))).toBeLessThan(1000)
  })

  it('a few seconds off is left alone', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T20:00:10Z'), toFake: ['Date'] })
    const e = await load()
    e.serverSaid('2026-11-07T20:00:00Z', Date.now() - 100, Date.now())
    expect(e.now()).toBe(Date.now())
  })

  it('a slow answer is not trusted', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T22:00:00Z'), toFake: ['Date'] })
    const e = await load()
    e.serverSaid('2026-11-07T20:00:00Z', Date.now() - 15_000, Date.now())
    expect(e.now()).toBe(Date.now())
  })

  it('an answer without the time changes nothing', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T20:00:00Z'), toFake: ['Date'] })
    const e = await load()
    e.serverSaid(undefined, Date.now(), Date.now())
    expect(e.now()).toBe(Date.now())
  })

  it('is remembered when the app opens again without signal', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T19:00:00Z'), toFake: ['Date'] })
    const first = await load()
    first.serverSaid('2026-11-07T20:00:00Z', Date.now(), Date.now())
    const again = await load()
    expect(Math.abs(again.now() - Date.parse('2026-11-07T20:00:00Z'))).toBeLessThan(1000)
  })
})
