import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { applyConfig, now, serverSaid, type EventConfig } from './event'
import { stripGps } from './exif'
import * as outbox from './outbox'
import { everyRow, photoId } from './ids'
import { makePreview, storageCopy } from './preview'
import { termsAccepted } from './terms'
import type { Frame, Guest, Mission, Photo, Reaction, Wall } from './types'
import { BRAND, storageKey } from '../brand/brand'

// Public project address and publishable key of this event's own Supabase (see src/brand/brand.ts): safe in
// the browser, every write is checked by the database. No fallback on purpose, so a copy never talks to
// another event's database.
const URL_: string = BRAND.supabaseUrl
const KEY: string = BRAND.supabaseKey
if (!URL_ || !KEY) throw new Error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_KEY no .env deste evento')
const BUCKET = 'fotos'

// The login session stays on the phone, so a guest signs in once.
export const db = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: storageKey('session') } })

// Photos live in a private bucket: the app asks for links that expire, so a leaked link stops working.
const LINK_TTL = 6 * 3600
const LINK_REUSE_MS = 3 * 3600_000

// Full-quality originals go to Cloudflare R2 (10 GB free) through the app's r2 function, once it is set up;
// until then they stay in the bucket above.
const R2_FN = `${URL_}/functions/v1/r2`
let r2Ready: Promise<boolean> | null = null
const r2On = () =>
  (r2Ready ??= fetch(`${R2_FN}?op=status`)
    .then((r) => r.json())
    .then((j: { ready?: boolean }) => {
      // a "no" is asked again next time: it may just have been a bad connection
      if (!j.ready) r2Ready = null
      return !!j.ready
    })
    .catch((e) => {
      r2Ready = null
      note('r2 status', e)
      return false
    }))

/** Tells the server which upload step failed on this phone (text only), to fix problems before the party. */
function note(step: string, e: unknown) {
  const why = e instanceof Error ? `${e.name}: ${e.message}` : ((e as { message?: string })?.message ?? String(e))
  db.rpc('log_client_error', { p_note: `${step}: ${why}`.slice(0, 300), p_ua: navigator.userAgent.slice(0, 200) }).then(() => undefined, () => undefined)
}

/** Asks the r2 function for a 10-minute link to put or get one original */
async function r2Link(op: 'put' | 'get', path: string) {
  const { data } = await db.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('sem login')
  const res = await fetch(`${R2_FN}?op=${op}&path=${encodeURIComponent(path)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: KEY } })
  if (!res.ok) throw new Error(`r2 ${res.status}`)
  return (await res.json()) as { url?: string; exists?: boolean }
}

/** Upload links for several files of one photo in a single call (original, 1080px copy, thumbnail); each link
 * only takes that exact size and type */
async function r2Many(files: { path: string; size: number; type: string }[]) {
  const { data } = await db.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('sem login')
  const res = await fetch(`${R2_FN}?op=put-many`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  })
  if (!res.ok) throw new Error(`r2 ${res.status}`)
  return ((await res.json()) as { paths: Record<string, { url?: string; exists?: boolean }> }).paths
}

/** Organizer: is R2 on, and let the app's site talk to the bucket */
export const r2Status = () => r2On()
export async function r2Setup() {
  const { data } = await db.auth.getSession()
  const res = await fetch(`${R2_FN}?op=setup`, { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token}`, apikey: KEY } })
  if (!res.ok) throw new Error('r2 setup')
}

/** The original of a photo stored on R2, as a file */
export async function readOriginal(path: string) {
  const { url } = await r2Link('get', path)
  const res = await fetch(url!)
  if (!res.ok) throw new Error('falha ao baixar')
  return res.blob()
}

/** A value from the link (?c=, ?i=), remembered on this phone and taken off the address bar. */
function fromLink(param: string, key: string): string {
  try {
    const q = new URLSearchParams(location.search).get(param)
    if (q) {
      localStorage.setItem(key, q)
      const url = new URL(location.href)
      url.searchParams.delete(param)
      history.replaceState(null, '', url)
    }
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

/** The event code from the printed QR or the telão (?c=...), remembered on this phone. */
const CODE_KEY = storageKey('code')
export const eventCode = () => fromLink('c', CODE_KEY)

/** The personal invitation (?i=...), remembered on this phone. */
const INVITE_KEY = storageKey('invite')
export const inviteToken = () => fromLink('i', INVITE_KEY)

/** Keeps a code or invitation typed on the closed door, as if it had come in the link. */
export function rememberEntry(kind: 'code' | 'invite', value: string) {
  try {
    localStorage.setItem(kind === 'code' ? CODE_KEY : INVITE_KEY, value)
  } catch {
    /* private mode: works until the page closes */
  }
}

/** The código de volta in the QR the organizer shows (?v=...): used once, never kept. */
export function returnCodeFromLink(): string {
  try {
    const q = new URLSearchParams(location.search).get('v')
    if (!q) return ''
    const url = new URL(location.href)
    url.searchParams.delete('v')
    history.replaceState(null, '', url)
    return q.toUpperCase().replace(/[^A-Z0-9]/g, '')
  } catch {
    return ''
  }
}

export class JoinError extends Error {
  // code: the door is only for invited guests; full: the invitation's seats are taken; name: someone with
  // this name is already in (maybe this person, on another phone)
  constructor(public reason: 'code' | 'busy' | 'back' | 'full' | 'name' | 'other') {
    super(reason)
  }
}

/** Why the join function said no, from its status and answer. */
async function joinFailure(error: unknown): Promise<JoinError> {
  const res = (error as { context?: Response }).context
  const status = res?.status
  if (status === 429) return new JoinError('busy')
  if (status === 403) return new JoinError('code')
  if (status === 404) return new JoinError('back')
  if (status === 409) {
    const body = await res!.json().catch(() => null)
    return new JoinError(body?.error === 'nome' ? 'name' : 'full')
  }
  return new JoinError('other')
}

/** Checks the event code on the server, which creates the guest's login. */
// made before the first try and sent with every try of the same sign-up: when an answer is lost on the
// way and the guest taps "Entrar" again, the server signs into the guest it already made
const JOIN_KEY = storageKey('joinkey')
function joinKey() {
  try {
    const saved = localStorage.getItem(JOIN_KEY)
    if (saved) return saved
    const fresh = crypto.randomUUID()
    localStorage.setItem(JOIN_KEY, fresh)
    return fresh
  } catch {
    return undefined
  }
}

export async function join(code: string, g: Omit<Guest, 'id'>, sameName = false): Promise<Guest> {
  const { data, error } = await db.functions.invoke('join', {
    body: { code, invite: inviteToken(), name: g.name, instagram: g.instagram ?? '', face: g.faceOptIn, terms: termsAccepted(), key: joinKey(), same_name: sameName },
  })
  if (error) throw await joinFailure(error)
  const { error: sessionError } = await db.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
  if (sessionError) throw new JoinError('other')
  try {
    localStorage.setItem(CODE_KEY, code)
    localStorage.removeItem(JOIN_KEY)
  } catch {
    /* private mode */
  }
  // on a repeat it is the guest made the first time (with the name sent then)
  return { ...g, id: data.guest_id as string, name: (data.name as string | undefined) ?? g.name }
}

/** Signs in with the answer of an existing account (código de volta, or a name picked on an invitation). */
async function signedBack(data: Record<string, unknown>): Promise<Guest> {
  const { error: sessionError } = await db.auth.setSession({ access_token: data.access_token as string, refresh_token: data.refresh_token as string })
  if (sessionError) throw new JoinError('other')
  return { id: data.guest_id as string, name: String(data.name ?? ''), instagram: (data.instagram as string | null) ?? undefined, faceOptIn: !!data.face }
}

/** Back into an existing account on this phone with its código de volta, instead of joining again. */
export async function comeBack(code: string): Promise<Guest> {
  const { data, error } = await db.functions.invoke('join', { body: { back: code } })
  if (error) throw await joinFailure(error)
  return signedBack(data)
}

export type InviteInfo = { label: string; seats: number; people: { id: string; name: string }[] }

/** Who already came in with this invitation; null when the link is wrong or was cancelled. */
export async function peekInvite(token: string): Promise<InviteInfo | null> {
  const { data, error } = await db.functions.invoke('join', { body: { invite: token, peek: true } })
  if (!error) return data as InviteInfo
  const why = await joinFailure(error)
  if (why.reason === 'back') return null
  throw why
}

/** Back into the account of the name picked on the invitation. */
export async function joinAs(token: string, guestId: string): Promise<Guest> {
  const { data, error } = await db.functions.invoke('join', { body: { invite: token, as: guestId } })
  if (error) throw await joinFailure(error)
  return signedBack(data)
}

/** Whether the event code opens the door (checked before the guest fills in the form). */
export async function checkCode(code: string): Promise<boolean> {
  const { error } = await db.functions.invoke('join', { body: { check: code } })
  if (!error) return true
  const why = await joinFailure(error)
  if (why.reason === 'code') return false
  throw why
}

/** This guest's código de volta (made on first ask). */
export const myReturnCode = () => call<string>('my_return_code')

/** True when this phone still has a login (it can be lost if the browser clears its data). No signal at
 * the venue is not a lost login: renewing it failed, but it is still kept and renews when the signal is back. */
export async function hasSession() {
  const { data, error } = await db.auth.getSession()
  return !!data.session || isAuthRetryableFetchError(error)
}

/** Signs out this phone only: the same guest on another phone (código de volta) stays signed in. */
export const leave = () => db.auth.signOut({ scope: 'local' })

/** Calls back when this phone's login ends for good (signed out, or it could no longer be renewed). */
export const onSignedOut = (fn: () => void) => db.auth.onAuthStateChange((e) => e === 'SIGNED_OUT' && fn()).data.subscription

/** A light copy (1600px) only for face matching; the face server deletes it once read. */
async function lightCopy(file: Blob, width: number, quality?: number) {
  const url = await makePreview(file as File, width, quality)
  try {
    return await fetch(url).then((r) => r.blob())
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Sends the selfie for face matching. The server keeps only its numbers and deletes the photo. */
export async function sendSelfie(guestId: string, selfie: Blob) {
  const path = `selfie/${guestId}/${crypto.randomUUID()}.jpg`
  const { error } = await db.storage.from(BUCKET).upload(path, await lightCopy(selfie, 1080), { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  const { error: e2 } = await db.rpc('set_selfie', { p_path: path })
  if (e2) throw e2
}

/** Recognition off: my selfie photo is deleted (the server may not have read it yet), then its numbers. */
export async function faceOptOut(guestId: string) {
  const dir = `selfie/${guestId}`
  const { data: files, error: listError } = await db.storage.from(BUCKET).list(dir)
  if (listError) return { error: listError }
  if (files?.length) {
    const { error } = await db.storage.from(BUCKET).remove(files.map((f) => `${dir}/${f.name}`))
    if (error) return { error }
  }
  return db.rpc('face_opt_out')
}

export type FaceProgress = { status: 'none' | 'pending' | 'ready' | 'failed'; reading: boolean; worker: boolean; ahead: number }

/** Where my selfie's analysis is: server on, selfie being read, selfies ahead of mine. */
export async function myFaceProgress(): Promise<FaceProgress | null> {
  const { data, error } = await db.rpc('my_face_progress')
  return error || !data ? null : (data as FaceProgress)
}

export async function myFaceStatus(guestId: string) {
  const { data } = await db.from('guests').select('face_status').eq('id', guestId).single()
  return (data?.face_status ?? 'none') as 'none' | 'pending' | 'ready' | 'failed'
}

/** Party times (always) and place (with the invitation code or a login), from the organizer's settings. */
export async function loadEvent(code?: string) {
  const sentAt = Date.now()
  const { data, error } = await db.rpc('event_public', { p_code: code || null })
  if (error || !data) return false
  serverSaid((data as EventConfig).now, sentAt, Date.now())
  applyConfig(data as EventConfig)
  return true
}

// ---- organizer tools: every call is checked again by the database ----

// no answer from the server (bad signal) is not a "no": it throws, so nobody loses the panel to the wifi
const noAnswer = (error: { code?: string } | null) => !!error && !error.code

export async function claimAdmin(code: string) {
  const { data, error } = await db.rpc('claim_admin', { p_code: code })
  if (noAnswer(error)) throw error
  return !error && data === true
}

export async function amAdmin() {
  const { data, error } = await db.rpc('is_admin')
  if (noAnswer(error)) throw error
  return data === true
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw error
  return data as T
}

/** A face (or a tapped point) in a photo and who it is: the face server's guess or a person's tag. */
export interface Spot {
  id: string
  /** fractions of the photo; w = h = 0 for a point tapped by hand */
  x: number
  y: number
  w: number
  h: number
  guestId: string | null
  /** set by a person (a face marked as nobody from the app stays hidden) */
  byHand: boolean
}

export async function loadSpots(photoId: string): Promise<Spot[]> {
  const { data, error } = await db.from('photo_spots').select('id,x,y,w,h,guest_id,by_hand').eq('photo_id', photoId)
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, guestId: r.guest_id, byHand: r.by_hand }))
}

/** Whoever took the photo (or an organizer) says who a face is; spot null tags a new point at x, y. */
export const tagSpot = (photoId: string, spot: string | null, guestId: string | null, at?: { x: number; y: number }) =>
  call<string | null>('tag_spot', { p_photo: photoId, p_spot: spot, p_x: at?.x ?? null, p_y: at?.y ?? null, p_guest: guestId })

/** A tagged guest takes their own tag off. */
export const untagMe = (spot: string) => call<void>('untag_me', { p_spot: spot })

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
  /** only invited guests sign up (personal invitation or the event code) */
  invite_only: boolean
  /** switches for the day: face recognition, the missions tab, the ranking tab */
  faces_on: boolean
  missions_on: boolean
  ranking_on: boolean
  /** missions with people: on, the biggest group drawn, and how many guests the party needs before they start */
  gen_missions: boolean
  gen_max_people: number
  gen_min_guests: number
}

/** points of a mission with people by group size (the server's people_points) */
export const PEOPLE_POINTS = [10, 25, 45, 70, 100, 135]

export const admin = {
  event: async () => {
    const { data, error } = await db.from('event_config').select('*').single()
    if (error) throw error
    return data as AdminEvent
  },
  saveEvent: (p: Partial<AdminEvent>) => call<void>('admin_update_event', { p }),
  code: async () => (await call<{ code: string }>('admin_secrets')).code,
  setCode: (code: string) => call<void>('admin_set_code', { p_code: code }),
  saveMission: (m: { id?: string; title: string; points: number; active: boolean; sort: number; target: string }) =>
    call<string>('admin_mission', { p_id: m.id ?? null, p_title: m.title, p_points: m.points, p_active: m.active, p_sort: m.sort, p_target: m.target }),
  clearPhotos: () => call<number>('admin_clear_photos'),
  stats: () => call<{ guests: number; photos: number; bytes: number }>('admin_stats'),
  faceStats: () => call<{ has_secret: boolean; worker_seen: string | null; selfies: number; pending: number }>('admin_face_stats'),
  faceSecret: () => call<string>('admin_face_secret'),
  wipeFaces: () => call<void>('admin_wipe_faces'),
  invites: () => call<AdminInvite[]>('admin_invites'),
  addInvites: (lines: string) => call<number>('admin_invites_add', { p_lines: lines }),
  setInvite: (id: string, p: { label?: string; seats?: number; revoked?: boolean }) => call<void>('admin_invite_set', { p_id: id, p }),
  findGuests: (q: string) => call<FoundGuest[]>('admin_find_guests', { p_q: q }),
  /** everyone's name, to suggest who has to appear in a mission */
  guestNames: async () => {
    const { data } = await everyRow<{ name: string }>((a, b) => db.from('guests').select('name').order('name').range(a, b))
    return [...new Set((data ?? []).map((g) => g.name))]
  },
  returnCode: (guestId: string) => call<string>('admin_return_code', { p_guest: guestId }),
}

export interface AdminInvite {
  id: string
  token: string
  label: string
  seats: number
  revoked: boolean
  /** names of who came in with it, in order */
  people: string[]
}

export interface FoundGuest {
  id: string
  name: string
  instagram: string | null
  created_at: string
  invite: string | null
  photos: number
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
  /** null while the face check of a mission that names someone is pending */
  mission_ok?: boolean | null
  /** the original is on Cloudflare R2 instead of the bucket */
  on_r2?: boolean
  /** small copy for the grid, in the bucket (photos sent before it existed have none) */
  thumb_path?: string | null
  /** light copies on R2: viewing links signed by the server (renewed daily) */
  thumb_url?: string | null
  preview_url?: string | null
  /** posted by an organizer outside the hours: only organizers see it */
  test?: boolean
  /** last change on the server: what the feed asks for since */
  updated_at?: string
}

export interface MissionRow {
  id: string
  title: string
  points: number
  active: boolean
  sort: number
  /** who has to appear in the photo (loose name match), or null */
  target: string | null
  /** set on a mission with people, generated for this guest only */
  owner?: string | null
  /** guests who have to appear, on a mission with people */
  targets?: string[] | null
  updated_at?: string
}

interface ReactionRow {
  photo_id: string
  guest_id: string
  emoji: Reaction
  active: boolean
  created_at?: string
}

/** what of a photo is read from the app's bucket and needs a link: R2 copies come with their own */
const signable = (x: PhotoRow) => [
  ...(x.preview_url ? [] : [x.preview_path]),
  ...(x.thumb_path ? [x.thumb_path] : []),
  ...(x.on_r2 ? [] : [x.original_path]),
]

const rKey = (r: Pick<ReactionRow, 'photo_id' | 'guest_id' | 'emoji'>) => `${r.photo_id}|${r.guest_id}|${r.emoji}`

/** Photos sent from this phone, shown at once while they upload */
interface Local {
  file: File
  url: string
  preview: string
  status: 'sending' | 'failed' | 'sent'
  row: PhotoRow
  /** set when trying again won't help (limit reached, file refused): the guest is told why */
  problem?: string
  /** the phone could not keep a copy for later: it only lives while the app stays open */
  unsafe?: boolean
}

/** Why a photo can't go, in the guest's words, when trying again won't help; undefined for passing trouble. */
export function lastingProblem(e: unknown): string | undefined {
  const m = (e as { message?: string })?.message ?? String(e)
  if (/limite de fotos/.test(m)) return 'Você chegou no limite de fotos.'
  if (/câmera fechada|looks fechados/.test(m)) return 'A câmera já fechou.'
  if (/too large|payload|maximum allowed size|413/i.test(m)) return 'A foto é grande demais.'
  if (/mime|not supported|invalid_type/i.test(m)) return 'Esse formato de foto não é aceito.'
  if (/row-level security|quota/i.test(m)) return 'Seu espaço de fotos encheu.'
  return undefined
}

export type LiveState = 'loading' | 'live' | 'offline'

/**
 * The whole party, live: photos, looks and reactions from everyone, kept in sync over a realtime channel.
 * Only signed-in guests can read; writes go through database functions that check who is calling.
 */
/** Stable pseudo-random number for a string (FNV-1a), for per-guest shuffles */
function seeded(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return h >>> 0
}

/** swaps of people per guest on missions with people (the server's event_config.gen_swaps enforces it) */
const PEOPLE_SWAPS = 3

/** peopleOn: missions with people are running (the party is on) */
export function useParty(me: Guest | null, peopleOn = false) {
  const [guests, setGuests] = useState<Map<string, string>>(new Map())
  const [rows, setRows] = useState<Map<string, PhotoRow>>(new Map())
  const [reactions, setReactions] = useState<Map<string, ReactionRow>>(new Map())
  const [local, setLocal] = useState<Map<string, Local>>(new Map())
  const [state, setState] = useState<LiveState>('loading')
  const [reload, setReload] = useState(0)
  const [links, setLinks] = useState<Map<string, string>>(new Map())
  const [missionRows, setMissionRows] = useState<MissionRow[]>([])
  const [eventVersion, setEventVersion] = useState(0)
  // who appears in which photo: photo id -> guest ids
  const [faces, setFaces] = useState<Map<string, Set<string>>>(new Map())
  const signedAt = useRef(new Map<string, number>())
  const localRef = useRef(local)
  localRef.current = local
  // photos deleted by their author while still on their way: they must never be published
  const cancelled = useRef(new Set<string>())
  // removing a photo is final: once a photo is seen removed, an older answer arriving late never brings it back
  const gone = useRef(new Set<string>())
  const guestsRef = useRef(guests)
  guestsRef.current = guests
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  useEffect(() => {
    if (!me) return
    let alive = true
    let subscribedOnce = false
    let socketUp = false

    const sign = async (paths: string[]) => {
      const now = Date.now()
      const due = paths.filter((p) => now - (signedAt.current.get(p) ?? 0) > LINK_REUSE_MS)
      if (!due.length) return
      // a broken answer (a captive wifi page instead of the server) is just no links this time
      const { data } = await db.storage.from(BUCKET).createSignedUrls(due, LINK_TTL).catch(() => ({ data: null }))
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

    // one read of the names at a time: many photos from new guests arriving together ask once
    let guestsLoading: Promise<void> | null = null
    const loadGuests = () =>
      (guestsLoading ??= (async () => {
        try {
          const { data } = await everyRow<{ id: string; name: string }>((a, b) => db.from('guests').select('id,name').order('id').range(a, b))
          if (alive && data) setGuests(new Map(data.map((x) => [x.id as string, x.name as string])))
        } finally {
          guestsLoading = null
        }
      })())

    // what changed is asked "since" the newest change already seen, a little before it: a change that
    // started earlier but finished later is caught by the overlap (rows are merged by id, so twice is fine)
    const OVERLAP_MS = 15_000
    const cursor = { photos: '', reactions: '', faces: '', missions: '' }
    const since = (at: string) => new Date(Date.parse(at) - OVERLAP_MS).toISOString()
    const advance = (key: keyof typeof cursor, ats: (string | undefined)[]) => {
      for (const at of ats) if (at && at > cursor[key]) cursor[key] = at
    }

    const MISSION_COLS = 'id,title,points,active,sort,target,owner,targets,updated_at'
    // a guest who joined after this phone read the names: read them again so missions say who to find
    const missionNames = (list: MissionRow[]) => {
      const known = guestsRef.current
      if (list.some((m) => m.targets?.some((id) => !known.has(id)))) void loadGuests()
    }
    const loadMissions = async () => {
      const { data } = await everyRow<MissionRow>((a, b) => db.from('missions').select(MISSION_COLS).order('sort').order('id').range(a, b))
      if (!alive || !data) return
      advance('missions', data.map((m) => m.updated_at))
      setMissionRows(data)
      missionNames(data)
    }
    // after a nudge, only the missions that changed (missions are never deleted, only turned off)
    const missionsSince = async () => {
      const { data } = await everyRow<MissionRow>((a, b) =>
        db.from('missions').select(MISSION_COLS).gt('updated_at', since(cursor.missions)).order('updated_at').order('id').range(a, b),
      )
      if (!alive || !data?.length) return
      advance('missions', data.map((m) => m.updated_at))
      setMissionRows((rows) => {
        const byId = new Map(rows.map((m) => [m.id, m]))
        for (const m of data) byId.set(m.id, m)
        return [...byId.values()].sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      })
      missionNames(data)
    }

    const loadFaces = async () => {
      const { data } = await everyRow<{ photo_id: string; guest_id: string; updated_at: string }>((a, b) =>
        db.from('photo_faces').select('photo_id,guest_id,updated_at').order('photo_id').order('guest_id').range(a, b),
      )
      if (!alive || !data) return
      const m = new Map<string, Set<string>>()
      for (const f of data) m.set(f.photo_id, (m.get(f.photo_id) ?? new Set()).add(f.guest_id))
      advance('faces', data.map((f) => f.updated_at as string))
      setFaces(m)
    }

    const mergePhotos = (list: PhotoRow[]) => {
      if (!list.length) return
      if (list.some((row) => !guestsRef.current.has(row.guest_id))) void loadGuests()
      void sign(list.filter((x) => !x.removed_at).flatMap((x) => signable(x)))
      setRows((m) => {
        const next = new Map(m)
        for (const row of list) {
          if (row.removed_at) {
            gone.current.add(row.id)
            next.delete(row.id)
          } else if (!gone.current.has(row.id)) next.set(row.id, row)
        }
        return next
      })
    }

    // one look at a time: on a slow network, nudges arriving meanwhile are gathered into one more look
    // after it, never piled up as requests
    const ALL = ['photos', 'reactions', 'photo_faces', 'missions', 'event_config']
    // and at most one every 2 s, however many nudges arrive
    const GAP_MS = 2_000
    let looking = false
    let lastStart = 0
    let pending: Set<string> | null = null
    const catchUp = async (what: string[] = ALL) => {
      const wait = lastStart + GAP_MS - Date.now()
      if (looking || wait > 0) {
        const first = !pending
        pending = new Set([...(pending ?? []), ...what])
        if (first && !looking) setTimeout(() => void lookPending(), wait)
        return
      }
      looking = true
      lastStart = Date.now()
      try {
        await lookOnce(what)
      } finally {
        looking = false
      }
      if (pending) setTimeout(() => void lookPending(), Math.max(0, lastStart + GAP_MS - Date.now()))
    }
    const lookPending = () => {
      const next = pending
      pending = null
      if (next && alive) return catchUp([...next])
    }

    // only what changed since the last look: cheap enough to run on every nudge and every return to the app
    const lookOnce = async (what: string[]) => {
      if (!cursor.photos) return load()
      const jobs: Promise<unknown>[] = []
      if (what.includes('photos'))
        jobs.push(
          (async () => {
            // page by page: one change can touch more than 1000 photos at once (the organizer clearing the feed)
            const from = since(cursor.photos)
            const { data } = await everyRow<PhotoRow>((a, b) => db.from('photos').select('*').gt('updated_at', from).order('updated_at').order('id').range(a, b))
            if (!alive || !data) return
            advance('photos', data.map((x) => x.updated_at))
            mergePhotos(data as PhotoRow[])
          })(),
        )
      if (what.includes('reactions') && cursor.reactions)
        jobs.push(
          (async () => {
            const { data } = await db.from('reactions').select('photo_id,guest_id,emoji,active,created_at').gt('created_at', since(cursor.reactions)).order('created_at')
            if (!alive || !data?.length) return
            advance('reactions', data.map((x) => x.created_at))
            setReactions((m) => {
              const next = new Map(m)
              for (const r of data as ReactionRow[]) {
                // an older answer arriving late never undoes a newer tap
                const cur = next.get(rKey(r))
                if (!cur || (cur.created_at ?? '') <= (r.created_at ?? '')) next.set(rKey(r), r)
              }
              return next
            })
          })(),
        )
      // tags taken off are told for a day only: a phone that last saw a change longer ago reads them all again
      const facesFresh = cursor.faces && Date.now() - Date.parse(cursor.faces) < 20 * 3600_000
      if (what.includes('photo_faces') && facesFresh)
        jobs.push(
          (async () => {
            const from = since(cursor.faces)
            const { data } = await everyRow<{ photo_id: string; guest_id: string; shown: boolean; at: string }>((a, b) =>
              db.rpc('faces_since', { p_since: from }).order('at').order('photo_id').order('guest_id').range(a, b),
            )
            if (!alive || !data?.length) return
            const list = data
            if (list.some((f) => !guestsRef.current.has(f.guest_id))) void loadGuests()
            advance('faces', list.map((f) => f.at))
            setFaces((m) => {
              const next = new Map(m)
              for (const f of list) {
                const set = new Set(next.get(f.photo_id) ?? [])
                if (f.shown) set.add(f.guest_id)
                else set.delete(f.guest_id)
                next.set(f.photo_id, set)
              }
              return next
            })
          })(),
        )
      if (what.includes('photo_faces') && !facesFresh) jobs.push(loadFaces())
      if (what.includes('missions')) jobs.push(cursor.missions ? missionsSince() : loadMissions())
      if (what.includes('event_config')) jobs.push(loadEvent().then((ok) => ok && alive && setEventVersion((n) => n + 1)))
      await Promise.all(jobs)
    }

    const load = async () => {
      void loadMissions()
      void loadFaces()
      void loadEvent().then((ok) => ok && alive && setEventVersion((n) => n + 1))
      // page by page: the server answers at most 1000 rows at a time, and a big party has more
      const [g, p, r] = await Promise.all([
        everyRow<{ id: string; name: string }>((a, b) => db.from('guests').select('id,name').order('id').range(a, b)),
        everyRow<PhotoRow>((a, b) => db.from('photos').select('*').is('removed_at', null).order('created_at', { ascending: false }).order('id').range(a, b)),
        everyRow<ReactionRow>((a, b) =>
          db.from('reactions').select('photo_id,guest_id,emoji,active,created_at').eq('active', true).order('photo_id').order('guest_id').order('emoji').range(a, b),
        ),
      ])
      if (!alive) return
      if (!g.data || !p.data || !r.data) {
        setState('offline')
        return
      }
      setGuests(new Map(g.data.map((x) => [x.id as string, x.name as string])))
      setRows(new Map((p.data as PhotoRow[]).filter((x) => !gone.current.has(x.id)).map((x) => [x.id, x])))
      void sign((p.data as PhotoRow[]).flatMap((x) => signable(x)))
      setReactions(new Map((r.data as ReactionRow[]).map((x) => [rKey(x), x])))
      // an empty table still gets a starting point; it comes from the server's own times as soon as
      // there are rows, never from this phone's clock alone (a clock running fast would skip changes)
      const start = '2000-01-01T00:00:00.000Z'
      cursor.photos = start
      cursor.reactions = start
      advance('photos', (p.data as PhotoRow[]).map((x) => x.updated_at))
      advance('reactions', (r.data as ReactionRow[]).map((x) => x.created_at))
      setState('live')
    }

    // the database sends a tiny nudge at most every few seconds naming what changed (never the data, so
    // a party of hundreds stays within the live limits); each phone then asks only for what is new
    const channel = db
      .channel('live', { config: { private: true } })
      .on('broadcast', { event: 'tick' }, ({ payload }) => void catchUp(Array.isArray(payload?.t) ? payload.t : undefined))
      .subscribe((status) => {
        // catch up on every re-subscribe so nothing is missed while the socket was down
        if (status === 'SUBSCRIBED' && subscribedOnce) void catchUp()
        if (status === 'SUBSCRIBED') subscribedOnce = true
        socketUp = status === 'SUBSCRIBED'
      })

    // read right away too: some networks block the live socket, the feed still shows
    load()
    // a look now and then anyway: every 20 s without the socket, every minute with it (a missed nudge)
    let lastLook = Date.now()
    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastLook < (socketUp ? 60_000 : 20_000)) return
      lastLook = Date.now()
      void catchUp()
      resign()
    }, 5_000)

    // photo links last 6 hours and a party is longer: links older than 3 hours are made again
    const resign = () => void sign([...rowsRef.current.values()].flatMap((x) => signable(x)))
    // phones drop sockets in the background: catch up when the app comes back
    const wake = () => {
      if (document.visibilityState !== 'visible') return
      void catchUp()
      resign()
    }
    document.addEventListener('visibilitychange', wake)

    return () => {
      alive = false
      clearInterval(poll)
      document.removeEventListener('visibilitychange', wake)
      db.removeChannel(channel)
    }
    // the guest, not their profile: a new selfie or name must not tear the feed down and read it all again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, reload])

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
      // on screen an R2 original is stood in for by the preview; the download fetches the real file
      url: l?.url ?? (row.on_r2 ? (row.preview_url ?? links.get(row.preview_path)) : links.get(row.original_path)),
      r2Path: row.on_r2 ? row.original_path : undefined,
      preview: l?.preview ?? row.preview_url ?? links.get(row.preview_path),
      thumb: l?.preview ?? row.thumb_url ?? (row.thumb_path ? links.get(row.thumb_path) : undefined),
      file: l?.file,
      bytes: row.bytes ?? l?.file.size,
      status: l?.status === 'sent' ? undefined : l?.status,
      problem: l?.status === 'failed' ? l.problem : undefined,
      kept: l?.status === 'failed' && !l.unsafe && !l.problem,
      reactions: counts.get(row.id) ?? { '🔥': 0, '😂': 0, '😍': 0, '🥂': 0 },
      mine: mine.get(row.id) ?? {},
      missionId: row.mission_id ?? undefined,
      faces: [...(faces.get(row.id) ?? [])].map((g) => guests.get(g) ?? 'Convidado'),
      test: row.test,
    })
    for (const l of local.values()) {
      const row = rows.get(l.row.id)
      // sent and then removed (by its author on another phone or by an organizer): gone here too
      if (l.status === 'sent' && !row) continue
      all.set(l.row.id, toPhoto(row ?? l.row, l))
    }
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
  }, [rows, reactions, guests, local, links, faces, me?.id, me?.name])

  // ranking of who appears most, from the face matches on photos still in the feed
  const appearances = useMemo(() => {
    const count = new Map<string, number>()
    for (const [photo, set] of faces) {
      if (!rows.has(photo)) continue
      for (const g of set) count.set(g, (count.get(g) ?? 0) + 1)
    }
    return [...count].map(([g, value]) => ({ id: g, name: guests.get(g) ?? 'Convidado', value })).sort((a, b) => b.value - a.value)
  }, [faces, rows, guests])

  // a mission counts once per guest, from a photo the server accepted for it (when it names someone,
  // that person's face has to be found in the photo)
  const { missions, points, peopleOpen, peopleDone, swapsUsed } = useMemo(() => {
    const done = new Set<string>()
    const checking = new Set<string>()
    const missed = new Set<string>()
    const byGuest = new Map<string, Set<string>>()
    for (const row of rows.values()) {
      if (!row.mission_id) continue
      const mine = row.guest_id === me?.id
      if (row.mission_ok === true) {
        const set = byGuest.get(row.guest_id) ?? new Set()
        set.add(row.mission_id)
        byGuest.set(row.guest_id, set)
        if (mine) done.add(row.mission_id)
      } else if (mine) (row.mission_ok === false ? missed : checking).add(row.mission_id)
    }
    for (const l of local.values()) if (l.row.mission_id && l.status !== 'failed' && !rows.has(l.row.id)) checking.add(l.row.mission_id)
    const value = new Map(missionRows.map((m) => [m.id, m.points]))
    // each guest gets the missions in their own random order, the same on every load (seeded by their id)
    const missions: Mission[] = missionRows
      .filter((m) => !m.owner && (m.active || done.has(m.id)))
      .map((m) => ({
        id: m.id,
        title: m.title,
        points: m.points,
        target: m.target ?? undefined,
        done: done.has(m.id),
        status: done.has(m.id) ? undefined : checking.has(m.id) ? ('checking' as const) : missed.has(m.id) ? ('missed' as const) : undefined,
      }))
      .sort((a, b) => seeded(`${me?.id}:${a.id}`) - seeded(`${me?.id}:${b.id}`))
    // missions with people, generated for me: the open one and the ones done, newest first
    const mine = missionRows.filter((m) => m.owner === me?.id).sort((a, b) => b.sort - a.sort)
    const asMission = (m: MissionRow): Mission => ({
      id: m.id,
      title: m.title,
      points: m.points,
      people: (m.targets ?? []).map((id) => guests.get(id) ?? 'Convidado'),
      done: done.has(m.id),
      status: done.has(m.id) ? undefined : checking.has(m.id) ? ('checking' as const) : missed.has(m.id) ? ('missed' as const) : undefined,
    })
    const peopleOpen = mine.find((m) => m.active && !done.has(m.id))
    const peopleDone = mine.filter((m) => done.has(m.id)).map(asMission)
    const swapsUsed = mine.filter((m) => !m.active && !done.has(m.id)).length
    const points = [...byGuest]
      .map(([g, set]) => ({ id: g, name: guests.get(g) ?? 'Convidado', value: [...set].reduce((a, id) => a + (value.get(id) ?? 0), 0) }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
    return { missions, points, peopleOpen: peopleOpen && asMission(peopleOpen), peopleDone, swapsUsed }
  }, [rows, local, missionRows, guests, me?.id])

  // missions with people: ask the server for my open one (it creates the next when the last is done, or
  // says how many guests are still missing to unlock them)
  const [peopleNeed, setPeopleNeed] = useState<number>()
  const [peopleOff, setPeopleOff] = useState(false)
  const peopleKey = `${peopleOpen?.id ?? '-'}:${peopleDone.length}:${guests.size}`
  useEffect(() => {
    if (!me || !peopleOn || peopleOpen) return
    let alive = true
    call<{ id: string | null; need?: number; off?: boolean }>('people_mission').then(
      (r) => {
        // an empty answer (a proxy, an older server) is no mission, not a crash
        if (!alive || !r) return
        setPeopleNeed(r.id ? undefined : r.need)
        setPeopleOff(!!r.off)
      },
      () => undefined,
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, peopleOn, peopleKey])
  const people = { current: peopleOpen, done: peopleDone, need: peopleNeed, off: peopleOff, swapsLeft: Math.max(0, PEOPLE_SWAPS - swapsUsed) }
  const swapPeople = (id: string) => call<{ id: string }>('people_swap', { p_id: id })

  const hide = async (photoId: string) => {
    // not sent yet: stop it here; a send already past the server is hidden as soon as it lands
    cancelled.current.add(photoId)
    void outbox.done(photoId)
    const { error } = await db.rpc('hide_photo', { p_id: photoId })
    if (error) throw error
    gone.current.add(photoId)
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
    // the state wanted, not a flip: sent twice or answered out of order, it ends the same
    const { error } = await db.rpc('set_reaction', { p_photo: photoId, p_emoji: emoji, p_active: optimistic.active })
    setReactions((m) => {
      // a newer tap on the same reaction meanwhile wins over this answer
      if (m.get(key) !== optimistic) return m
      return new Map(m).set(key, { ...optimistic, active: error ? was : optimistic.active })
    })
  }

  const send = async (l: Local) => {
    if (!me) return
    const { file, preview } = l
    let row = l.row
    setLocal((m) => new Map(m).set(row.id, { ...l, status: 'sending' }))
    try {
      const previewBlob = await fetch(preview).then((r) => r.blob())
      // the server keeps a full-resolution JPEG at 92%; this phone keeps the camera file
      // the copy never carries where the photo was taken (gallery photos keep their EXIF otherwise)
      const stored = await stripGps(await storageCopy(file))
      if (stored !== file) row = { ...row, original_path: row.original_path.replace(/\.[^.]+$/, '.jpg'), bytes: stored.size }
      const up = async (path: string, body: Blob, type: string) => {
        const { error } = await db.storage.from(BUCKET).upload(path, body, { contentType: type, cacheControl: '31536000', upsert: false })
        // a retry after a half-finished attempt finds the file already there (with a full quota the server
        // answers with the quota refusal instead of "already exists", so ask whether it is there)
        if (error && !/exists|Duplicate/i.test(error.message) && !(await db.storage.from(BUCKET).exists(path).then((r) => r.data, () => false))) {
          note(`upload ${/-[pt]\.jpg$/.test(path) ? 'preview' : 'original'}`, error)
          throw error
        }
      }
      // the 1080px copy and a ~30 KB thumbnail for the grid go to R2 when it is on (no download fees),
      // else to the app's bucket; the original goes to R2 too and falls back to the bucket on its own
      const thumbPath = row.preview_path.replace(/-p\.jpg$/, '-t.jpg')
      const thumbBlob = await lightCopy(previewBlob, 480, 0.72)
      const storedType = stored.type || 'image/jpeg'
      const r2Put = (await r2On())
        ? await r2Many([
            { path: row.original_path, size: stored.size, type: storedType },
            { path: row.preview_path, size: previewBlob.size, type: 'image/jpeg' },
            { path: thumbPath, size: thumbBlob.size, type: 'image/jpeg' },
          ]).catch((e) => (note('r2', e), null))
        : null
      const toR2 = async (path: string, body: Blob, type: string) => {
        const link = r2Put?.[path]
        if (!link) return false
        if (link.exists) return true
        const res = await fetch(link.url!, { method: 'PUT', body, headers: { 'Content-Type': type } }).catch((e) => (note('r2', e), null))
        if (!res?.ok) note('r2', new Error(`r2 upload ${res?.status}`))
        return !!res?.ok
      }
      const lightOnR2 = (await toR2(row.preview_path, previewBlob, 'image/jpeg')) && (await toR2(thumbPath, thumbBlob, 'image/jpeg'))
      if (!lightOnR2) {
        await up(row.preview_path, previewBlob, 'image/jpeg')
        await up(thumbPath, thumbBlob, 'image/jpeg').catch(() => undefined)
      }
      // party photos also get a 1600px copy for the face server, deleted after it is read
      if (row.kind === 'party') await up(row.original_path.replace(/\.[^.]+$/, '') + '-f.jpg', await lightCopy(file, 1600), 'image/jpeg').catch(() => undefined)
      // the database notices the original isn't in its bucket
      const onR2 = await toR2(row.original_path, stored, storedType)
      if (onR2) row = { ...row, on_r2: true }
      else await up(row.original_path, stored, storedType)
      if (cancelled.current.has(row.id)) return
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
      if (error) {
        note('send_photo', error)
        throw error
      }
      // the server has it: the phone no longer needs to hold it for a retry
      void outbox.done(row.id)
      // deleted while this send was on its way: take it down again
      if (cancelled.current.has(row.id)) {
        void db.rpc('hide_photo', { p_id: row.id })
        return
      }
      // keep the local copy: the original stays on this phone for instant downloads
      setLocal((m) => {
        const cur = m.get(row.id)
        return cur ? new Map(m).set(row.id, { ...cur, row, status: 'sent' }) : m
      })
      setRows((m) => (m.has(row.id) ? m : new Map(m).set(row.id, { ...row, created_at: new Date().toISOString() })))
    } catch (e) {
      if (cancelled.current.has(row.id)) return
      // without a login every send is refused like a full space: that is not the photo's problem, it waits
      // and goes once the guest is back in
      const lasting = (await hasSession()) ? lastingProblem(e) : undefined
      const problem = lasting ?? (l.unsafe ? 'Sem espaço no celular pra guardar: não feche o app antes de enviar.' : undefined)
      setLocal((m) => new Map(m).set(row.id, { ...l, row, status: 'failed', problem }))
    }
  }

  // photos still on this phone from before (app closed, no signal): show them and send them again on
  // their own, when the app opens, when the signal comes back and every half minute while it fails
  useEffect(() => {
    if (!me) return
    let alive = true
    const tries = new Map<string, number>()
    const resend = async () => {
      if (!navigator.onLine || document.visibilityState !== 'visible') return
      for (const p of await outbox.waiting(me.id)) {
        if (!alive) return
        // never dropped on its own: an unsent photo may be the only copy (camera photos skip the gallery)
        if (cancelled.current.has(p.id)) continue
        const cur = localRef.current.get(p.id)
        if (cur?.status === 'sending' || cur?.status === 'sent') continue
        // trying again won't help: it stays here, with the reason, for the guest to save on the phone
        if (cur?.problem) continue
        const n = tries.get(p.id) ?? 0
        // after a few tries it waits for the person's own "tentar de novo"
        if (n >= 8) continue
        tries.set(p.id, n + 1)
        const file = new File([p.file], p.fileName, { type: p.file.type })
        const l: Local = cur ?? { file, url: URL.createObjectURL(file), preview: URL.createObjectURL(p.preview), row: p.row as PhotoRow, status: 'failed' }
        if (!cur) setLocal((m) => new Map(m).set(p.id, l))
        await send(l)
      }
    }
    // signal back or the app back on screen: a fresh round of tries
    const again = () => {
      if (document.visibilityState !== 'visible') return
      tries.clear()
      void resend()
    }
    void resend()
    const timer = setInterval(() => void resend(), 30_000)
    window.addEventListener('online', again)
    document.addEventListener('visibilitychange', again)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('online', again)
      document.removeEventListener('visibilitychange', again)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id])

  /** Posts a photo: shows it at once, uploads the preview and the untouched original, then publishes it. */
  const post = (file: File, preview: string, kind: Wall, caption: string, frame: Frame, missionId?: string) => {
    if (!me) return
    // the id carries the moment it was taken, so a late send (no signal at the party) is still accepted
    const id = photoId(now())
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
    const l: Local = { file, url: URL.createObjectURL(file), preview, row, status: 'sending' }
    // kept on the phone first, so the photo survives the app closing before it is sent
    const kept = fetch(preview)
      .then((r) => r.blob())
      .then((blob) => outbox.keep({ id, guest: me.id, row, file, fileName: file.name, preview: blob, at: Date.now() }))
      .catch(() => false)
    void kept.then((ok) => {
      // the phone could not hold it (full or private mode): if this send fails, closing the app loses it
      if (!ok) note('outbox', new Error('não guardou no celular'))
      return send(ok ? l : { ...l, unsafe: true })
    })
    // resolves once the photo is on the phone's list to send
    return kept
  }

  const retry = (id: string) => {
    const l = localRef.current.get(id)
    if (l) void send(l)
  }

  return { photos, guests, state, missions, people, swapPeople, allMissions: missionRows.filter((m) => !m.owner), points, appearances, eventVersion, react, post, retry, hide, reconnect: () => setReload((n) => n + 1) }
}
