import { beforeEach, describe, expect, it } from 'vitest'
import { APP_OPENS, EVENT, LOOK_CLOSES, LOOK_OPENS, applyConfig, lookOpen, phaseAt, split, until } from '../event'

const at = (s: string) => new Date(`${s}:00-03:00`).getTime()

const config = {
  app_opens: '2026-11-06T20:00:00-03:00',
  party_starts: '2026-11-07T10:00:00-03:00',
  party_ends: '2026-11-07T20:00:00-03:00',
  look_opens: '2026-11-07T07:00:00-03:00',
  look_closes: '2026-11-07T12:00:00-03:00',
  test_mode: false,
  place: null,
  address: null,
  maps_url: null,
}

describe('party phases', () => {
  beforeEach(() => applyConfig(config, false))

  it('follows the clock from countdown to after the party', () => {
    expect(phaseAt(at('2026-11-06T19:59'))).toBe('countdown')
    expect(phaseAt(at('2026-11-06T20:00'))).toBe('warmup')
    expect(phaseAt(at('2026-11-07T07:00'))).toBe('look')
    expect(phaseAt(at('2026-11-07T10:00'))).toBe('party')
    expect(phaseAt(at('2026-11-07T20:00'))).toBe('after')
  })

  it('keeps the outfit wall open from 7h to 12h, overlapping the party', () => {
    expect(lookOpen(at('2026-11-07T06:59'))).toBe(false)
    expect(lookOpen(at('2026-11-07T11:59'))).toBe(true)
    expect(phaseAt(at('2026-11-07T11:00'))).toBe('party')
    expect(lookOpen(at('2026-11-07T12:00'))).toBe(false)
  })

  it('takes new times from the organizer', () => {
    applyConfig({ ...config, app_opens: '2026-12-01T18:00:00-03:00', party_starts: '2026-12-02T12:00:00-03:00', party_ends: '2026-12-02T22:00:00-03:00' }, false)
    expect(APP_OPENS.toISOString()).toBe('2026-12-01T21:00:00.000Z')
    expect(EVENT.end.toISOString()).toBe('2026-12-03T01:00:00.000Z')
    expect(phaseAt(at('2026-12-02T15:00'))).toBe('party')
  })

  it('ignores a broken date instead of breaking the app', () => {
    applyConfig({ ...config, look_opens: 'nope' }, false)
    expect(LOOK_OPENS.toISOString()).toBe('2026-11-07T10:00:00.000Z')
    expect(LOOK_CLOSES.toISOString()).toBe('2026-11-07T15:00:00.000Z')
  })

  it('keeps the place once it was unlocked by the invitation code', () => {
    applyConfig({ ...config, place: 'Espaço X', address: 'Rua Y', maps_url: 'https://maps', lat: -23.5, lng: -46.6 }, false)
    applyConfig(config, false)
    expect(EVENT.place).toBe('Espaço X')
    expect(EVENT.lat).toBe(-23.5)
  })
})

describe('time labels', () => {
  it('splits and words a countdown', () => {
    expect(split(90_061_000)).toEqual({ d: 1, h: 1, m: 1, s: 1 })
    expect(until(26 * 3600_000)).toBe('1 dia e 2h')
    expect(until(65 * 60_000)).toBe('1h 05min')
    expect(until(10_000)).toBe('1 min')
  })
})
