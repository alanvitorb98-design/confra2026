/**
 * Photos on their way to the server, kept on this phone (IndexedDB) until the server confirms them.
 * Closing the app, losing signal or a reload never loses a photo: the next time the app opens it sends
 * what is still here. If the browser has no IndexedDB (rare private modes), no space or does not answer in time, keep() says so.
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

/** how long the phone gets to answer: some iPhones leave IndexedDB hanging after a long time in the background */
export const WAIT_MS = 5000

let opening: Promise<IDBDatabase | null> | null = null

function open() {
  opening ??= new Promise<IDBDatabase | null>((resolve) => {
    setTimeout(() => resolve(null), WAIT_MS)
    try {
      const req = indexedDB.open(NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  }).then((db) => {
    // a phone that did not answer gets asked again next time instead of staying without storage
    if (!db) opening = null
    return db
  })
  return opening
}

async function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open()
  if (!db) return null
  return new Promise((resolve) => {
    // a hung write must not hold the photo back: the app then sends it straight away
    setTimeout(() => resolve(null), WAIT_MS)
    try {
      const tx = db.transaction(STORE, mode)
      const req = work(tx.objectStore(STORE))
      // a write only counts once the transaction is on disk (a full phone aborts it at commit)
      tx.oncomplete = () => resolve(req.result ?? null)
      tx.onabort = tx.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Keeps a photo on this phone; false when it could not be stored (no space, no IndexedDB, no answer). */
export const keep = (p: Pending) => run('readwrite', (s) => s.put(p)).then((key) => key !== null)

export const done = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined)

export const waiting = async (guest: string) => ((await run<Pending[]>('readonly', (s) => s.getAll())) ?? []).filter((p) => p.guest === guest)
