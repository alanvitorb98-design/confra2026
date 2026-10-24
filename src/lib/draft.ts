/**
 * The photo on the developing screen, kept on this phone until it is posted or discarded: closing the app, a
 * reload, or the phone dropping the browser in the background while the guest answers a message brings it back
 * on the same screen. One photo at a time; a new shot replaces it. Without IndexedDB it simply is not kept.
 */
const NAME = 'foto-revelando'
const STORE = 'foto'
const KEY = 'atual'
// a shot left on the screen overnight is not the party any more
const MAX_AGE = 12 * 3600_000

interface Stored {
  guest: string
  file: Blob
  name: string
  type: string
  lastModified: number
  mission?: string
  at: number
}

export interface Draft {
  file: File
  mission?: string
}

let opening: Promise<IDBDatabase | null> | null = null

function open() {
  opening ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opening
}

async function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode)
      const req = work(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result ?? null)
      tx.onabort = tx.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export const keepDraft = (guest: string, file: File, mission?: string) =>
  run('readwrite', (s) =>
    s.put({ guest, file, name: file.name, type: file.type, lastModified: file.lastModified, mission, at: Date.now() } satisfies Stored, KEY),
  ).then(() => undefined)

/** Forgets the photo; with a file, only if it is still that one (a newer shot may have replaced it). */
export const dropDraft = (only?: File) =>
  run('readwrite', (s) => {
    const req = s.get(KEY)
    req.onsuccess = () => {
      const d = req.result as Stored | undefined
      if (d && (!only || (d.name === only.name && d.lastModified === only.lastModified && d.file.size === only.size))) s.delete(KEY)
    }
    return req
  }).then(() => undefined)

/** The photo this guest left on the developing screen, if any. */
export async function findDraft(guest: string): Promise<Draft | null> {
  const d = await run<Stored | undefined>('readonly', (s) => s.get(KEY))
  if (!d || d.guest !== guest || Date.now() - d.at > MAX_AGE) return null
  return { file: new File([d.file], d.name, { type: d.type, lastModified: d.lastModified }), mission: d.mission }
}
