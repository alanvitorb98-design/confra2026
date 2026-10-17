import { describe, expect, it } from 'vitest'

// Every source file of the app, as text: text a guest typed is only ever shown as text (React escapes it),
// and nothing builds HTML or code from strings.
const files = import.meta.glob(['../../**/*.{ts,tsx}', '!../../**/__tests__/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

describe('app source', () => {
  it('was read', () => {
    expect(Object.keys(files).length).toBeGreaterThan(10)
  })

  it('never turns strings into HTML or code', () => {
    const risky = /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(/
    const hits = Object.entries(files).filter(([, src]) => risky.test(src)).map(([path]) => path)
    expect(hits).toEqual([])
  })

  it('links only to https or the app itself', () => {
    const hits = Object.entries(files).filter(([, src]) => /href=\{?["'`](?:javascript|data):/i.test(src)).map(([path]) => path)
    expect(hits).toEqual([])
  })

  it('never ships a server key', () => {
    const hits = Object.entries(files).filter(([, src]) => /service_role|sb_secret_/.test(src)).map(([path]) => path)
    expect(hits).toEqual([])
  })
})
