import { useEffect, useState } from 'react'

// Everything about the party date. The organizer edits it in the admin panel; these are the
// defaults until the server answers (and the last answer is cached on the phone). Times are Brasília (-03:00).
export const EVENT = {
  start: new Date('2026-11-07T10:00:00-03:00'),
  end: new Date('2026-11-07T20:00:00-03:00'),
  /** null until the invitation code or a login unlocks it */
  place: null as string | null,
  address: '',
  mapsUrl: '',
  lat: null as number | null,
  lng: null as number | null,
  testMode: false,
}

/** The app opens one day before the party */
export let APP_OPENS = new Date('2026-11-06T20:00:00-03:00')
/** The outfit wall: 7h to 12h on the party day, overlapping the first two hours of the party */
export let LOOK_OPENS = new Date('2026-11-07T07:00:00-03:00')
export let LOOK_CLOSES = new Date('2026-11-07T12:00:00-03:00')

/** What the server sends (see the event_public function) */
export interface EventConfig {
  app_opens: string
  party_starts: string
  party_ends: string
  look_opens: string
  look_closes: string
  test_mode: boolean
  place: string | null
  address: string | null
  maps_url: string | null
  lat?: number | null
  lng?: number | null
}

const CONFIG_KEY = 'confra26.event'

export function applyConfig(c: EventConfig, cache = true) {
  const date = (v: string, fallback: Date) => (Number.isNaN(Date.parse(v)) ? fallback : new Date(v))
  EVENT.start = date(c.party_starts, EVENT.start)
  EVENT.end = date(c.party_ends, EVENT.end)
  APP_OPENS = date(c.app_opens, APP_OPENS)
  LOOK_OPENS = date(c.look_opens, LOOK_OPENS)
  LOOK_CLOSES = date(c.look_closes, LOOK_CLOSES)
  EVENT.testMode = !!c.test_mode
  // the place only comes with the code: never forget it because a later answer came without
  if (c.place) {
    EVENT.place = c.place
    EVENT.address = c.address ?? ''
    EVENT.mapsUrl = c.maps_url ?? ''
    EVENT.lat = c.lat ?? null
    EVENT.lng = c.lng ?? null
  }
  if (!cache) return
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...c, place: EVENT.place, address: EVENT.address, maps_url: EVENT.mapsUrl, lat: EVENT.lat, lng: EVENT.lng }))
  } catch {
    /* private mode */
  }
}

try {
  const raw = localStorage.getItem(CONFIG_KEY)
  if (raw) applyConfig(JSON.parse(raw) as EventConfig, false)
} catch {
  /* no cache yet */
}

export const lookOpen = (now: number) => now >= LOOK_OPENS.getTime() && now < LOOK_CLOSES.getTime()

export type Phase = 'countdown' | 'warmup' | 'look' | 'party' | 'after'

export function phaseAt(now: number): Phase {
  if (now < APP_OPENS.getTime()) return 'countdown'
  if (now < LOOK_OPENS.getTime()) return 'warmup'
  if (now < EVENT.start.getTime()) return 'look'
  if (now < EVENT.end.getTime()) return 'party'
  return 'after'
}

// Test clock: open the app with ?agora=2026-11-07T08:00 to see any phase, ?agora=off to go back.
// Kept per tab so a test link never sticks to a guest's phone.
const KEY = 'confra.agora'
let offset = 0
try {
  const q = new URLSearchParams(location.search).get('agora')
  if (q === 'off') sessionStorage.removeItem(KEY)
  else if (q) sessionStorage.setItem(KEY, q)
  const fake = sessionStorage.getItem(KEY)
  const at = fake ? new Date(fake.length <= 16 ? `${fake}:00-03:00` : fake).getTime() : NaN
  if (!Number.isNaN(at)) offset = at - Date.now()
} catch {
  /* storage blocked: real clock */
}
export const testClock = offset !== 0

export const now = () => Date.now() + offset

/** Current time, ticking every second while a countdown is on screen, else every 15 seconds. */
export function useNow(everySecond = false) {
  const [t, setT] = useState(now)
  useEffect(() => {
    const id = setInterval(() => setT(now()), everySecond ? 1000 : 15_000)
    return () => clearInterval(id)
  }, [everySecond])
  return t
}

export function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}

/** "5h 12min" / "2 dias e 3h" style, for short labels */
export function until(ms: number) {
  const { d, h, m } = split(ms)
  if (d > 0) return `${d} ${d === 1 ? 'dia' : 'dias'} e ${h}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  return `${Math.max(1, m)} min`
}

export const clock = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
export const day = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

/**
 * "Salvar na agenda" opens the phone's own calendar instead of downloading a file:
 * Google Calendar's add-event screen on Android, and on iPhone a calendar link that iOS turns into
 * its "Add to Calendar" sheet.
 */
export function openCalendar(code: string) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (ios) {
    location.href = `https://optapzbhyhklcirdoyid.supabase.co/functions/v1/agenda?c=${encodeURIComponent(code)}`
    return
  }
  const where = [EVENT.place, EVENT.address].filter(Boolean).join(' · ')
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Confra da Firma',
    dates: `${fmt(EVENT.start)}/${fmt(EVENT.end)}`,
    details: `Equipe Derhu${EVENT.mapsUrl ? ` · ${EVENT.mapsUrl}` : ''}`,
    location: where,
    ctz: 'America/Sao_Paulo',
  })
  window.open(`https://calendar.google.com/calendar/render?${q}`, '_blank', 'noopener')
}
