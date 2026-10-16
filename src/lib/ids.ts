/**
 * A photo id that carries when it was taken (UUID version 7: the first 48 bits are the time in ms).
 * The server reads that time to accept a photo taken while the camera was open but sent much later,
 * after the phone got signal back.
 */
export function photoId(now = Date.now()): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  let t = now
  for (let i = 5; i >= 0; i--) {
    b[i] = t % 256
    t = Math.floor(t / 256)
  }
  b[6] = (b[6] & 0x0f) | 0x70
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** When a photoId was made, or null for ids without a time in them. */
export function takenAt(id: string): number | null {
  const h = id.replace(/-/g, '')
  if (h.length !== 32 || h[12] !== '7') return null
  return parseInt(h.slice(0, 12), 16)
}

/** Every row of a query, page by page: the server answers at most 1000 rows per request. */
export async function everyRow<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 1000) {
  const all: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error || !data) return { data: null, error: error ?? new Error('sem resposta') }
    all.push(...data)
    if (data.length < size) return { data: all, error: null }
  }
}
