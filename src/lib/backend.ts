import { createClient } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Frame, Guest, Photo, Reaction, Wall } from './types'

// Public project address and publishable key: safe in the browser, every write is checked by the database.
const URL_ = 'https://optapzbhyhklcirdoyid.supabase.co'
const KEY = 'sb_publishable_9PN8BMaKHBKkCdmIylVa-w_ajGUMRv3'
const BUCKET = 'fotos'

export const db = createClient(URL_, KEY, { auth: { persistSession: false } })

const publicUrl = (path: string) => db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Signs the guest in (or updates their profile) and returns them with their id and secret token. */
export async function join(g: Omit<Guest, 'id' | 'token'> & { token?: string }): Promise<Guest> {
  const token = g.token ?? newToken()
  const { data, error } = await db.rpc('join_party', { p_token: token, p_name: g.name, p_instagram: g.instagram ?? '', p_face: g.faceOptIn })
  if (error) throw error
  return { ...g, id: data as string, token }
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
 * Reads go straight to the tables; writes go through database functions that check the guest's token.
 */
export function useParty(me: Guest | null) {
  const [guests, setGuests] = useState<Map<string, string>>(new Map())
  const [rows, setRows] = useState<Map<string, PhotoRow>>(new Map())
  const [reactions, setReactions] = useState<Map<string, ReactionRow>>(new Map())
  const [local, setLocal] = useState<Map<string, Local>>(new Map())
  const [state, setState] = useState<LiveState>('loading')
  const [reload, setReload] = useState(0)
  const localRef = useRef(local)
  localRef.current = local
  const guestsRef = useRef(guests)
  guestsRef.current = guests

  useEffect(() => {
    if (!me) return
    let alive = true
    let subscribedOnce = false
    let socketUp = false

    const loadGuests = async () => {
      const { data } = await db.from('guests').select('id,name')
      if (alive && data) setGuests(new Map(data.map((x) => [x.id as string, x.name as string])))
    }

    const load = async () => {
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
        setRows((m) => {
          const next = new Map(m)
          if (row.removed_at) next.delete(row.id)
          else next.set(row.id, row)
          return next
        })
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
      url: l?.url ?? publicUrl(row.original_path),
      preview: l?.preview ?? publicUrl(row.preview_path),
      file: l?.file,
      bytes: row.bytes ?? l?.file.size,
      status: l?.status === 'sent' ? undefined : l?.status,
      reactions: counts.get(row.id) ?? { '🔥': 0, '😂': 0, '😍': 0, '🥂': 0 },
      mine: mine.get(row.id) ?? {},
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
  }, [rows, reactions, guests, local, me?.id, me?.name])

  const react = async (photoId: string, emoji: Reaction, force = false) => {
    if (!me) return
    const key = rKey({ photo_id: photoId, guest_id: me.id, emoji })
    const was = reactions.get(key)?.active ?? false
    if (force && was) return
    const optimistic = { photo_id: photoId, guest_id: me.id, emoji, active: force || !was }
    setReactions((m) => new Map(m).set(key, optimistic))
    const { data, error } = await db.rpc('toggle_reaction', { p_token: me.token, p_photo: photoId, p_emoji: emoji, p_force: force })
    setReactions((m) => new Map(m).set(key, { ...optimistic, active: error ? was : (data as boolean) }))
  }

  const send = async (l: Local) => {
    if (!me) return
    const { row, file, preview } = l
    setLocal((m) => new Map(m).set(row.id, { ...l, status: 'sending' }))
    try {
      const previewBlob = await fetch(preview).then((r) => r.blob())
      const up = async (path: string, body: Blob, type: string) => {
        const { error } = await db.storage.from(BUCKET).upload(path, body, { contentType: type, cacheControl: '31536000', upsert: false })
        // a retry after a half-finished attempt finds the file already there
        if (error && !/exists|Duplicate/i.test(error.message)) throw error
      }
      await up(row.preview_path, previewBlob, 'image/jpeg')
      await up(row.original_path, file, file.type || 'image/jpeg')
      const { error } = await db.rpc('post_photo', {
        p_token: me.token,
        p_id: row.id,
        p_kind: row.kind,
        p_caption: row.caption,
        p_frame: row.frame,
        p_tilt: row.tilt,
        p_original: row.original_path,
        p_preview: row.preview_path,
        p_bytes: file.size,
      })
      if (error) throw error
      // keep the local copy: the original stays on this phone for instant downloads
      setLocal((m) => {
        const cur = m.get(row.id)
        return cur ? new Map(m).set(row.id, { ...cur, status: 'sent' }) : m
      })
      setRows((m) => (m.has(row.id) ? m : new Map(m).set(row.id, { ...row, created_at: new Date().toISOString() })))
    } catch {
      setLocal((m) => new Map(m).set(row.id, { ...l, status: 'failed' }))
    }
  }

  /** Posts a photo: shows it at once, uploads the preview and the untouched original, then publishes it. */
  const post = (file: File, preview: string, kind: Wall, caption: string, frame: Frame) => {
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
    }
    void send({ file, url: URL.createObjectURL(file), preview, row, status: 'sending' })
  }

  const retry = (id: string) => {
    const l = localRef.current.get(id)
    if (l) void send(l)
  }

  return { photos, guests, state, react, post, retry, reconnect: () => setReload((n) => n + 1) }
}
