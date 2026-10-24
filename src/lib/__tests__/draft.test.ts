import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dropDraft, findDraft, keepDraft } from '../draft'

const shot = (name = 'IMG_0001.jpg') => new File(['pixels'], name, { type: 'image/jpeg', lastModified: 1_700_000_000_000 })

afterEach(async () => {
  vi.useRealTimers()
  await dropDraft()
})

describe('the photo being developed', () => {
  it('comes back as the same file, with its mission', async () => {
    await keepDraft('g1', shot(), 'm1')
    const d = await findDraft('g1')
    expect(d?.file.name).toBe('IMG_0001.jpg')
    expect(d?.file.type).toBe('image/jpeg')
    expect(d?.file.lastModified).toBe(1_700_000_000_000)
    expect(await d?.file.text()).toBe('pixels')
    expect(d?.mission).toBe('m1')
  })

  it('is gone once posted or discarded', async () => {
    await keepDraft('g1', shot())
    await dropDraft()
    expect(await findDraft('g1')).toBeNull()
  })

  it('posting the old shot late does not forget a newer one', async () => {
    const old = shot('a.jpg')
    await keepDraft('g1', old)
    await keepDraft('g1', shot('b.jpg'))
    await dropDraft(old)
    expect((await findDraft('g1'))?.file.name).toBe('b.jpg')
    await dropDraft(shot('b.jpg'))
    expect(await findDraft('g1')).toBeNull()
  })

  it('a new shot replaces the old one', async () => {
    await keepDraft('g1', shot('a.jpg'))
    await keepDraft('g1', shot('b.jpg'))
    expect((await findDraft('g1'))?.file.name).toBe('b.jpg')
  })

  it('is not handed to another guest on the same phone', async () => {
    await keepDraft('g1', shot())
    expect(await findDraft('g2')).toBeNull()
  })

  it('is forgotten after half a day', async () => {
    await keepDraft('g1', shot())
    vi.useFakeTimers({ now: Date.now() + 13 * 3600_000, toFake: ['Date'] })
    expect(await findDraft('g1')).toBeNull()
  })
})
