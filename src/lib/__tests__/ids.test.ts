import { describe, expect, it } from 'vitest'
import { everyRow, photoId, takenAt } from '../ids'

describe('photoId', () => {
  it('is a version 7 UUID that keeps the time it was made', () => {
    const at = Date.parse('2026-11-07T14:03:21.456Z')
    const id = photoId(at)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(takenAt(id)).toBe(at)
  })

  it('never repeats', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => photoId(1)))
    expect(ids.size).toBe(1000)
  })

  it('finds no time in older random ids', () => {
    expect(takenAt('3f2b1c4e-9a7d-4e21-8c3b-5d6e7f8a9b0c')).toBeNull()
  })
})

describe('everyRow', () => {
  const table = Array.from({ length: 2345 }, (_, i) => i)
  const page = (from: number, to: number) => Promise.resolve({ data: table.slice(from, to + 1), error: null })

  it('reads past the 1000-row answer limit', async () => {
    expect((await everyRow(page)).data).toHaveLength(2345)
  })

  it('stops at an exact multiple of the page size', async () => {
    const two = table.slice(0, 2000)
    const { data } = await everyRow((f, t) => Promise.resolve({ data: two.slice(f, t + 1), error: null }))
    expect(data).toHaveLength(2000)
  })

  it('reports an error instead of a partial list', async () => {
    let n = 0
    const { data, error } = await everyRow((f, t) => Promise.resolve(n++ ? { data: null, error: new Error('x') } : { data: table.slice(f, t + 1), error: null }))
    expect(data).toBeNull()
    expect(error).toBeTruthy()
  })
})
