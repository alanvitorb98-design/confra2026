/**
 * Photos on their way to the server, kept on this phone (IndexedDB) until the server confirms them.
 * Closing the app, losing signal or a reload never loses a photo: the next time the app opens it sends
 * what is still here. If the browser has no IndexedDB (rare private modes) it quietly keeps nothing.
 */
const NAME = 'fotos-a-enviar'
const STORE = 'fotos'

export interface Pending {
  id: string
  guest: string
  /** the photo's row as the app builds it before sending */
  row: unknown
  file: Blob
  fileName: string
  preview: Blob
  at: number
}

let opening: Promise<IDBDatabase | null> | null = null

function open() {
  opening ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
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
      const req = work(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export const keep = (p: Pending) => run('readwrite', (s) => s.put(p)).then(() => undefined)

export const done = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined)

export const waiting = async (guest: string) => ((await run<Pending[]>('readonly', (s) => s.getAll())) ?? []).filter((p) => p.guest === guest)
