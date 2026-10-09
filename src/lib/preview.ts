/**
 * Light copy of a camera photo for the screen: a 12 MP original is resampled on every frame
 * while it animates, which is what makes the develop and the feed stutter. The original File
 * stays untouched for downloads and the story card.
 */
export async function makePreview(file: Blob, width = 1080): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, { resizeWidth: width, resizeQuality: 'high', imageOrientation: 'from-image' })
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (blob) return URL.createObjectURL(blob)
  } catch {
    // older browsers without resize options: fall back to the original
  }
  return URL.createObjectURL(file)
}

/** Most phone browsers can't draw a canvas bigger than this (iOS Safari limit) */
const MAX_PIXELS = 16_000_000

/**
 * The copy kept on the server: full resolution, JPEG at 92%. On a phone screen it looks the same as
 * the camera file and takes about half the space. Small or already light files go up untouched.
 */
export async function storageCopy(file: File): Promise<File> {
  if (file.size < 1_500_000) return file
  try {
    const probe = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (probe.width * probe.height)))
    const w = Math.round(probe.width * scale)
    const h = Math.round(probe.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(probe, 0, 0, w, h)
    probe.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    canvas.width = canvas.height = 0
    if (blob && blob.size < file.size * 0.9) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    // decoding failed (old browser, odd format): keep the camera file
  }
  return file
}
