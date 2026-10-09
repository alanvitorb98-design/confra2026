/**
 * Light copy of a camera photo for the screen: a 12 MP original is resampled on every frame
 * while it animates, which is what makes the develop and the feed stutter. The original File
 * stays untouched for downloads and the story card.
 */
export async function makePreview(file: File, width = 1080): Promise<string> {
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
