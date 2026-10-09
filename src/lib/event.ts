import { useEffect, useState } from 'react'

// Everything about the party date lives here. Times are Brasília (-03:00).
export const EVENT = {
  start: new Date('2026-11-07T10:00:00-03:00'),
  end: new Date('2026-11-07T20:00:00-03:00'),
  place: 'Local da confra',
  address: '',
  mapsUrl: 'https://maps.app.goo.gl/hyafsQ7ASH6v94wcA',
}

const HOUR = 3600_000
/** The app opens one day before the party */
export const APP_OPENS = new Date(EVENT.start.getTime() - 24 * HOUR)
/** The outfit wall: 7h to 12h on the party day, overlapping the first two hours of the party */
export const LOOK_OPENS = new Date('2026-11-07T07:00:00-03:00')
export const LOOK_CLOSES = new Date('2026-11-07T12:00:00-03:00')

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

/** Calendar file for "Salvar na agenda" */
export function calendarFile() {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const where = EVENT.address || EVENT.mapsUrl
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Confra da Firma//PT-BR', 'BEGIN:VEVENT',
    `UID:confra-da-firma-${fmt(EVENT.start)}@confra`, `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(EVENT.start)}`, `DTEND:${fmt(EVENT.end)}`,
    'SUMMARY:Confra da Firma', `LOCATION:${where}`, `DESCRIPTION:Equipe Derhu · ${EVENT.mapsUrl}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  return new File([ics], 'confra-da-firma.ics', { type: 'text/calendar' })
}
