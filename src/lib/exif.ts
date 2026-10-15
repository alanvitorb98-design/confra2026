/**
 * Wipes the GPS block from a JPEG's EXIF without touching the image data, so a photo picked from the
 * gallery doesn't tell everyone where it was taken. Orientation, date and camera model stay. Files
 * that aren't JPEG, or whose EXIF can't be read, are returned as they are.
 */
export async function stripGps(file: File): Promise<File> {
  if (file.type && file.type !== 'image/jpeg') return file
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    return wipeGps(bytes) ? new File([bytes], file.name, { type: 'image/jpeg', lastModified: file.lastModified }) : file
  } catch {
    return file
  }
}

const TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8]

/** Zeroes the GPS IFD (entries and their out-of-line values) and its pointer, in place. True if anything changed. */
export function wipeGps(b: Uint8Array): boolean {
  if (b[0] !== 0xff || b[1] !== 0xd8) return false
  let p = 2
  while (p + 4 <= b.length && b[p] === 0xff) {
    const marker = b[p + 1]
    if (marker === 0xda || marker === 0xd9) return false // image data starts: no EXIF before it
    const len = (b[p + 2] << 8) | b[p + 3]
    // APP1 "Exif\0\0"
    if (marker === 0xe1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
      return wipeInTiff(b, p + 10, p + 2 + len)
    }
    p += 2 + len
  }
  return false
}

function wipeInTiff(b: Uint8Array, t: number, end: number): boolean {
  const le = b[t] === 0x49
  const u16 = (o: number) => (le ? b[t + o] | (b[t + o + 1] << 8) : (b[t + o] << 8) | b[t + o + 1])
  const u32 = (o: number) =>
    (le ? b[t + o] | (b[t + o + 1] << 8) | (b[t + o + 2] << 16) | (b[t + o + 3] << 24) : (b[t + o] << 24) | (b[t + o + 1] << 16) | (b[t + o + 2] << 8) | b[t + o + 3]) >>> 0
  const inside = (o: number, n: number) => o >= 0 && t + o + n <= end
  const zero = (o: number, n: number) => inside(o, n) && b.fill(0, t + o, t + o + n)

  const ifd0 = u32(4)
  if (!inside(ifd0, 2)) return false
  const count = u16(ifd0)
  for (let i = 0; i < count; i++) {
    const e = ifd0 + 2 + i * 12
    if (!inside(e, 12)) return false
    if (u16(e) !== 0x8825) continue
    const gps = u32(e + 8)
    if (inside(gps, 2)) {
      const n = u16(gps)
      for (let j = 0; j < n; j++) {
        const g = gps + 2 + j * 12
        if (!inside(g, 12)) break
        const size = (TYPE_SIZE[u16(g + 2)] ?? 1) * u32(g + 4)
        if (size > 4) zero(u32(g + 8), size)
      }
      zero(gps, 2 + n * 12 + 4)
    }
    zero(e, 2) // the entry becomes an unknown tag 0 with value 0: readers find no GPS block
    zero(e + 8, 4)
    return true
  }
  return false
}
