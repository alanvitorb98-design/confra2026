import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('a phone whose storage hangs', () => {
  it('gives up keeping the photo after a few seconds so it is sent straight away', async () => {
    vi.useFakeTimers()
    // IndexedDB that never answers, as some iPhones do after a long time in the background
    vi.stubGlobal('indexedDB', { open: () => ({}) })
    const { keep, WAIT_MS } = await import('../outbox')
    const kept = keep({ id: 'x', guest: 'g', row: {}, file: new Blob(['o']), fileName: 'x.jpg', preview: new Blob(['p']), at: 0 })
    await vi.advanceTimersByTimeAsync(WAIT_MS)
    await expect(kept).resolves.toBe(false)
  })

  it('asks the phone again on the next photo', async () => {
    vi.useFakeTimers()
    const open = vi.fn(() => ({}))
    vi.stubGlobal('indexedDB', { open })
    const { keep, WAIT_MS } = await import('../outbox')
    const p = { id: 'y', guest: 'g', row: {}, file: new Blob(['o']), fileName: 'y.jpg', preview: new Blob(['p']), at: 0 }
    const first = keep(p)
    await vi.advanceTimersByTimeAsync(WAIT_MS)
    await first
    const second = keep(p)
    await vi.advanceTimersByTimeAsync(WAIT_MS)
    await second
    expect(open).toHaveBeenCalledTimes(2)
  })
})
