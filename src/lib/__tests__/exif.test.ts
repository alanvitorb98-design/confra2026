import { describe, expect, it } from 'vitest'
import { wipeGps } from '../exif'

// JPEG with an APP1 EXIF: IFD0 holds Orientation and the GPS pointer; the GPS IFD holds a latitude (3 rationals)
function jpeg() {
  const tiff = new Uint8Array(80)
  const v = new DataView(tiff.buffer)
  tiff.set([0x49, 0x49, 0x2a, 0x00]) // little endian
  v.setUint32(4, 8, true)
  v.setUint16(8, 2, true) // two entries
  v.setUint16(10, 0x0112, true); v.setUint16(12, 3, true); v.setUint32(14, 1, true); v.setUint16(18, 6, true) // orientation 6
  v.setUint16(22, 0x8825, true); v.setUint16(24, 4, true); v.setUint32(26, 1, true); v.setUint32(30, 38, true) // GPS at 38
  v.setUint32(34, 0, true)
  v.setUint16(38, 1, true)
  v.setUint16(40, 0x0002, true); v.setUint16(42, 5, true); v.setUint32(44, 3, true); v.setUint32(48, 56, true) // latitude at 56
  v.setUint32(52, 0, true)
  for (let i = 56; i < 80; i++) tiff[i] = 0x7f
  const app1 = new Uint8Array(4 + 6 + tiff.length)
  app1.set([0xff, 0xe1, (app1.length - 2) >> 8, (app1.length - 2) & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0])
  app1.set(tiff, 10)
  const out = new Uint8Array(2 + app1.length + 4)
  out.set([0xff, 0xd8]); out.set(app1, 2); out.set([0xff, 0xda, 0, 2], 2 + app1.length)
  return out
}

describe('wipeGps', () => {
  it('removes the GPS block and keeps the orientation', () => {
    const b = jpeg()
    expect(wipeGps(b)).toBe(true)
    const t = 12 // TIFF header offset inside the file
    expect(b.slice(t + 56, t + 80).every((x) => x === 0)).toBe(true)
    expect(b[t + 22] | (b[t + 23] << 8)).toBe(0) // pointer tag gone
    expect(b[t + 18]).toBe(6) // orientation untouched
  })
  it('leaves files without EXIF alone', () => {
    expect(wipeGps(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe(false)
    expect(wipeGps(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false)
  })
})
