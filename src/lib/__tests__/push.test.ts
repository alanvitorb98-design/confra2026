import { describe, expect, test } from 'vitest'
import { wrongKey } from '../pushKey'

const ours = Uint8Array.from([4, 1, 2, 3])

describe('wrongKey', () => {
  test('the same key is not wrong', () => {
    expect(wrongKey(Uint8Array.from([4, 1, 2, 3]).buffer, ours)).toBe(false)
  })
  test("another event's key is wrong, so the phone signs up again", () => {
    expect(wrongKey(Uint8Array.from([4, 9, 9, 9]).buffer, ours)).toBe(true)
    expect(wrongKey(Uint8Array.from([4, 1, 2]).buffer, ours)).toBe(true)
  })
  test('a browser that does not tell the key keeps its subscription', () => {
    expect(wrongKey(null, ours)).toBe(false)
    expect(wrongKey(undefined, ours)).toBe(false)
  })
})
