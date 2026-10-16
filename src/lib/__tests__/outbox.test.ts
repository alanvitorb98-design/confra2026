import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { done, keep, waiting, type Pending } from '../outbox'

const photo = (id: string, guest = 'g1'): Pending => ({
  id,
  guest,
  row: { id },
  file: new Blob(['original']),
  fileName: `${id}.jpg`,
  preview: new Blob(['preview']),
  at: Date.now(),
})

describe('photos waiting to be sent', () => {
  it('keeps a photo until the server confirms it', async () => {
    await keep(photo('a'))
    expect((await waiting('g1')).map((p) => p.id)).toEqual(['a'])
    await done('a')
    expect(await waiting('g1')).toEqual([])
  })

  it('keeping the same photo twice leaves one copy', async () => {
    await keep(photo('b'))
    await keep(photo('b'))
    expect((await waiting('g1')).filter((p) => p.id === 'b')).toHaveLength(1)
    await done('b')
  })

  it('only hands back the photos of the guest asking', async () => {
    await keep(photo('c', 'g1'))
    await keep(photo('d', 'g2'))
    expect((await waiting('g2')).map((p) => p.id)).toEqual(['d'])
    await done('c')
    await done('d')
  })
})
