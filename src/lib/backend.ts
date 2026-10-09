import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { applyConfig, type EventConfig } from './event'
import { storageCopy } from './preview'
import type { Frame, Guest, Mission, Photo, Reaction, Wall } from './types'

// Public project address and publishable key: safe in the browser, every write is checked by the database.
const URL_ = 'https://optapzbhyhklcirdoyid.supabase.co'
const KEY = 'sb_publishable_9PN8BMaKHBKkCdmIylVa-w_ajGUMRv3'
const BUCKET = 'fotos'

// The login session stays on the phone, so a guest signs in once.
export const db = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'confra26.session' } })

// Photos live in a private bucket: the app asks for links that expire, so a leaked link stops working.
const LINK_TTL = 6 * 3600
const LINK_REUSE_MS = 3 * 3600_000

/** The event code from the invitation QR (?c=...), remembered on this phone. */
const CODE_KEY = 'confra26.code'
export function eventCode(): string {
  try {
    const q = new URLSearchParams(location.search).get('c')
    if (q) {
      localStorage.setItem(CODE_KEY, q)
      const url = new URL(location.href)
      url.searchParams.delete('c')
      history.replaceState(null, '', url)
    }
    return localStorage.getItem(CODE_KEY) ?? ''
  } catch {
    return ''
  }
}

export class JoinError extends Error {
  constructor(public reason: 'code' | 'busy' | 'other') {
    super(reason)
  }
}

/** Checks the event code on the server, which creates the guest's login. */
export async function join(code: string, g: Omit<Guest, 'id'>): Promise<Guest> {
  const { data, error } = await db.functions.invoke('join', {
    body: { code, name: g.name, instagram: g.instagram ?? '', face: g.faceOptIn },
  })
  if (error) {
    const status = (error as { context?: Response }).context?.status
    throw new JoinError(status === 403 ? 'code' : status === 429 ? 'busy' : 'other')
  }
  const { error: sessionError } = await db.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
  if (sessionError) throw new JoinError('other')
  try {
    localStorage.setItem(CODE_KEY, code)
  } catch {
    /* private mode */
  }
  return { ...g, id: data.guest_id as string }
}

/** True when this phone still has a login (it can be lost if the browser clears its data). */
export async function hasSession() {
  const { data } = await db.auth.getSession()
  return !!data.session
}

export const leave = () => db.auth.signOut()

/** Party times (always) and place (with the invitation code or a login), from the organizer's settings. */
export async function loadEvent(code?: string) {
  const { data, error } = await db.rpc('event_public', { p_code: code || null })
  if (error || !data) return false
  applyConfig(data as EventConfig)
  return true
}

// ---- organizer tools: every call is checked again by the database ----

export async function claimAdmin(code: string) {
  const { data, error } = await db.rpc('claim_admin', { p_code: code })
  return !error && data === true
}

export async function amAdmin() {
  const { data } = await db.rpc('is_admin')
  return data === true
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw error
  return data as T
}

export interface AdminEvent {
  app_opens: string
  party_starts: string
  party_ends: string
  look_opens: string
  look_closes: string
  place: string
  address: string
  maps_url: string
  lat: number | null
  lng: number | null
  test_mode: boolean
}

export const admin = {
  event: async () => {
    const { data, error } = await db.from('event_config').select('*').single()
    if (error) throw error
    return data as AdminEvent
  },
  saveEvent: (p: Partial<AdminEvent>) => call<void>('admin_update_event', { p }),
  code: async () => (await call<{ code: string }>('admin_secrets')).code,
  setCode: (code: string) => call<void>('admin_set_code', { p_code: code }),
  saveMission: (m: { id?: string; title: string; points: number; active: boolean; sort: number }) =>
    call<string>('admin_save_mission', { p_id: m.id ?? null, p_title: m.title, p_points: m.points, p_active: m.active, p_sort: m.sort }),
  clearPhotos: () => call<number>('admin_clear_photos'),
  stats: () => call<{ guests: number; photos: number; bytes: number }>('admin_stats'),
}

interface PhotoRow {
  id: string
  guest_id: string
  kind: Wall
  caption: string
  frame: Frame
  tilt: number
  original_path: string
  preview_path: string
  bytes: number | null
  created_at: string
  removed_at: string | null
  mission_id: string | null
}

export interface MissionRow {
  id: string
  title: string
  points: number
  active: boolean
  sort: number
}

interface ReactionRow {
  photo_id: string
  guest_id: string
  emoji: Reaction
  active: boolean
}

const rKey = (r: Pick<ReactionRow, 'photo_id' | 'guest_id' | 'emoji'>) => `${r.photo_id}|${r.guest_id}|${r.emoji}`

/** Photos sent from this phone, shown at once while they upload */
interface Local {
  file: File
  url: string
  preview: string
  status: 'sending' | 'failed' | 'sent'
  row: PhotoRow
}

export type LiveState = 'loading' | 'live' | 'offline'

/**
 * The whole party, live: photos, looks and reactions from everyone, kept in sync over a realtime channel.
 * Only signed-in guests can read; writes go through database functions that check who is calling.
 */
export function useParty(me: Guest | null) {
  const [guests, setGuests] = useState<Map<string, string>>(new Map())
  const [rows, setRows] = useState<Map<string, PhotoRow>>(new Map())
  const [reactions, setReactions] = useState<Map<string, ReactionRow>>(new Map())
  const [local, setLocal] = useState<Map<string, Local>>(new Map())
  const [state, setState] = useState<LiveState>('loading')
  const [reload, setReload] = useState(0)
  const [links, setLinks] = useState<Map<string, string>>(new Map())
  const [missionRows, setMissionRows] = useState<MissionRow[]>([])
  const [eventVersion, setEventVersion] = useState(0)
  const signedAt = useRef(new Map<string, number>())
  const localRef = useRef(local)
  localRef.current = local
  const guestsRef = useRef(guests)
  guestsRef.current = guests

  useEffect(() => {
    if (!me) return
    let alive = true
    let subscribedOnce = false
    let socketUp = false

    const sign = async (paths: string[]) => {
      const now = Date.now()
      const due = paths.filter((p) => now - (signedAt.current.get(p) ?? 0) > LINK_REUSE_MS)
      if (!due.length) return
      const { data } = await db.storage.from(BUCKET).createSignedUrls(due, LINK_TTL)
      if (!alive || !data) return
      setLinks((m) => {
        const next = new Map(m)
        for (const d of data) {
          if (!d.signedUrl || !d.path) continue
          next.set(d.path, d.signedUrl)
          signedAt.current.set(d.path, now)
        }
        return next
      })
    }

    const loadGuests = async () => {
      const { data } = await db.from('guests').select('id,name')
      if (alive && data) setGuests(new Map(data.map((x) => [x.id as string, x.name as string])))
    }

    const loadMissions = async () => {
      const { data } = await db.from('missions').select('id,title,points,active,sort').order('sort')
      if (alive && data) setMissionRows(data as MissionRow[])
    }

    const load = async () => {
      void loadMissions()
      void loadEvent().then((ok) => ok && alive && setEventVersion((n) => n + 1))
      const [g, p, r] = await Promise.all([
        db.from('guests').select('id,name'),
        db.from('photos').select('*').is('removed_at', null).order('created_at', { ascending: false }),
        db.from('reactions').select('photo_id,guest_id,emoji,active').eq('active', true),
      ])
      if (!alive) return
      if (g.error || p.error || r.error) {
        setState('offline')
        return
      }
      setGuests(new Map(g.data.map((x) => [x.id as string, x.name as string])))
      setRows(new Map((p.data as PhotoRow[]).map((x) => [x.id, x])))
      void sign((p.data as PhotoRow[]).flatMap((x) => [x.preview_path, x.original_path]))
      setReactions(new Map((r.data as ReactionRow[]).map((x) => [rKey(x), x])))
      setState('live')
    }

    const channel = db
      .channel('party')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, ({ new: n }) => {
        const row = n as PhotoRow
        if (!row.id) return
        // someone who just joined: fetch the names again
        if (!guestsRef.current.has(row.guest_id)) loadGuests()
        if (!row.removed_at) void sign([row.preview_path, row.original_path])
        setRows((m) => {
          const next = new Map(m)
          if (row.removed_at) next.delete(row.id)
          else next.set(row.id, row)
          return next
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, () => void loadMissions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_config' }, () => {
        void loadEvent().then((ok) => ok && alive && setEventVersion((n) => n + 1))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, ({ new: n }) => {
        const row = n as ReactionRow
        if (!row.photo_id) return
        setReactions((m) => new Map(m).set(rKey(row), row))
      })
      .subscribe((status) => {
        // reload on every re-subscribe so nothing is missed while the socket was down
        if (status === 'SUBSCRIBED' && subscribedOnce) load()
        if (status === 'SUBSCRIBED') subscribedOnce = true
        socketUp = status === 'SUBSCRIBED'
      })

    // read right away too: some networks block the live socket, the feed still shows
    load()
    // without the socket, check for new photos every half minute
    const poll = setInterval(() => !socketUp && document.visibilityState === 'visible' && load(), 30_000)

    // phones drop sockets in the background: refresh when the app comes back
    const wake = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', wake)

    return () => {
      alive = false
      clearInterval(poll)
      document.removeEventListener('visibilitychange', wake)
      db.removeChannel(channel)
    }
  }, [me, reload])

  const photos = useMemo<Photo[]>(() => {
    const counts = new Map<string, Record<Reaction, number>>()
    const mine = new Map<string, Partial<Record<Reaction, boolean>>>()
    for (const r of reactions.values()) {
      if (!r.active) continue
      const c = counts.get(r.photo_id) ?? { '🔥': 0, '😂': 0, '😍': 0, '🥂': 0 }
      c[r.emoji]++
      counts.set(r.photo_id, c)
      if (r.guest_id === me?.id) mine.set(r.photo_id, { ...mine.get(r.photo_id), [r.emoji]: true })
    }
    const all = new Map<string, Photo>()
    const toPhoto = (row: PhotoRow, l?: Local): Photo => ({
      id: row.id,
      kind: row.kind,
      author: guests.get(row.guest_id) ?? (row.guest_id === me?.id ? me.name : 'Convidado'),
      authorId: row.guest_id,
      caption: row.caption,
      frame: row.frame,
      tilt: row.tilt,
      takenAt: new Date(row.created_at),
      url: l?.url ?? links.get(row.original_path),
      preview: l?.preview ?? links.get(row.preview_path),
      file: l?.file,
      bytes: row.bytes ?? l?.file.size,
      status: l?.status === 'sent' ? undefined : l?.status,
      reactions: counts.get(row.id) ?? { '🔥': 0, '😂': 0, '😍': 0, '🥂': 0 },
      mine: mine.get(row.id) ?? {},
      missionId: row.mission_id ?? undefined,
    })
    for (const l of local.values()) all.set(l.row.id, toPhoto(rows.get(l.row.id) ?? l.row, l))
    for (const row of rows.values()) if (!all.has(row.id)) all.set(row.id, toPhoto(row))
    // a new look hides the guest's older one right away
    const latestLook = new Map<string, Photo>()
    for (const p of all.values()) {
      if (p.kind !== 'look') continue
      const prev = latestLook.get(p.authorId!)
      if (!prev || prev.takenAt < p.takenAt) latestLook.set(p.authorId!, p)
    }
    return [...all.values()]
      .filter((p) => p.kind !== 'look' || latestLook.get(p.authorId!) === p)
      .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())
  }, [rows, reactions, guests, local, links, me?.id, me?.name])

  // a mission counts once per guest, from the first photo posted for it
  const { missions, points } = useMemo(() => {
    const done = new Set<string>()
    const byGuest = new Map<string, Set<string>>()
    for (const row of rows.values()) {
      if (!row.mission_id) continue
      const set = byGuest.get(row.guest_id) ?? new Set()
      set.add(row.mission_id)
      byGuest.set(row.guest_id, set)
      if (row.guest_id === me?.id) done.add(row.mission_id)
    }
    for (const l of local.values()) if (l.row.mission_id && l.status !== 'failed') done.add(l.row.mission_id)
    const value = new Map(missionRows.map((m) => [m.id, m.points]))
    const missions: Mission[] = missionRows.filter((m) => m.active || done.has(m.id)).map((m) => ({ id: m.id, title: m.title, points: m.points, done: done.has(m.id) }))
    const points = [...byGuest]
      .map(([g, set]) => ({ name: guests.get(g) ?? 'Convidado', value: [...set].reduce((a, id) => a + (value.get(id) ?? 0), 0) }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
    return { missions, points }
  }, [rows, local, missionRows, guests, me?.id])

  const hide = async (photoId: string) => {
    const { error } = await db.rpc('hide_photo', { p_id: photoId })
    if (error) throw error
    setRows((m) => {
      const next = new Map(m)
      next.delete(photoId)
      return next
    })
    setLocal((m) => {
      const next = new Map(m)
      next.delete(photoId)
      return next
    })
  }

  const react = async (photoId: string, emoji: Reaction, force = false) => {
    if (!me) return
    const key = rKey({ photo_id: photoId, guest_id: me.id, emoji })
    const was = reactions.get(key)?.active ?? false
    if (force && was) return
    const optimistic = { photo_id: photoId, guest_id: me.id, emoji, active: force || !was }
    setReactions((m) => new Map(m).set(key, optimistic))
    const { data, error } = await db.rpc('react', { p_photo: photoId, p_emoji: emoji, p_force: force })
    setReactions((m) => new Map(m).set(key, { ...optimistic, active: error ? was : (data as boolean) }))
  }

  const send = async (l: Local) => {
    if (!me) return
    const { file, preview } = l
    let row = l.row
    setLocal((m) => new Map(m).set(row.id, { ...l, status: 'sending' }))
    try {
      const previewBlob = await fetch(preview).then((r) => r.blob())
      // the server keeps a full-resolution JPEG at 92%; this phone keeps the camera file
      const stored = await storageCopy(file)
      if (stored !== file) row = { ...row, original_path: row.original_path.replace(/\.[^.]+$/, '.jpg'), bytes: stored.size }
      const up = async (path: string, body: Blob, type: string) => {
        const { error } = await db.storage.from(BUCKET).upload(path, body, { contentType: type, cacheControl: '31536000', upsert: false })
        // a retry after a half-finished attempt finds the file already there
        if (error && !/exists|Duplicate/i.test(error.message)) throw error
      }
      await up(row.preview_path, previewBlob, 'image/jpeg')
      await up(row.original_path, stored, stored.type || 'image/jpeg')
      const { error } = await db.rpc('send_photo', {
        p_id: row.id,
        p_kind: row.kind,
        p_caption: row.caption,
        p_frame: row.frame,
        p_tilt: row.tilt,
        p_original: row.original_path,
        p_preview: row.preview_path,
        p_bytes: stored.size,
        p_mission: row.mission_id,
      })
      if (error) throw error
      // keep the local copy: the original stays on this phone for instant downloads
      setLocal((m) => {
        const cur = m.get(row.id)
        return cur ? new Map(m).set(row.id, { ...cur, row, status: 'sent' }) : m
      })
      setRows((m) => (m.has(row.id) ? m : new Map(m).set(row.id, { ...row, created_at: new Date().toISOString() })))
    } catch {
      setLocal((m) => new Map(m).set(row.id, { ...l, row, status: 'failed' }))
    }
  }

  /** Posts a photo: shows it at once, uploads the preview and the untouched original, then publishes it. */
  const post = (file: File, preview: string, kind: Wall, caption: string, frame: Frame, missionId?: string) => {
    if (!me) return
    const id = crypto.randomUUID()
    const ext = (file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? file.type.split('/')[1] ?? 'jpg').toLowerCase()
    const base = `${kind}/${me.id}/${id}`
    const row: PhotoRow = {
      id,
      guest_id: me.id,
      kind,
      caption,
      frame,
      tilt: Math.round((Math.random() * 4 - 2) * 10) / 10,
      original_path: `${base}.${ext}`,
      preview_path: `${base}-p.jpg`,
      bytes: file.size,
      created_at: new Date().toISOString(),
      removed_at: null,
      mission_id: kind === 'party' ? (missionId ?? null) : null,
    }
    void send({ file, url: URL.createObjectURL(file), preview, row, status: 'sending' })
  }

  const retry = (id: string) => {
    const l = localRef.current.get(id)
    if (l) void send(l)
  }

  return { photos, guests, state, missions, allMissions: missionRows, points, eventVersion, react, post, retry, hide, reconnect: () => setReload((n) => n + 1) }
}
