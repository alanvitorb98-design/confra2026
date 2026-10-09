import type { Photo } from './types'

function fileName(photo: Photo, source: string) {
  const ext = /\.[a-z0-9]{2,5}$/i.exec(source)?.[0] ?? '.jpg'
  const stamp = photo.takenAt.toISOString().slice(0, 16).replace(/[-:T]/g, '')
  return `confra26-${photo.author.toLowerCase().replace(/\s+/g, '-')}-${stamp}${ext}`
}

/**
 * Hands over the original file, byte for byte. On phones the share sheet is
 * the way to reach "Save to Photos"; elsewhere it falls back to a download.
 */
export async function savePhoto(photo: Photo) {
  if (photo.file) return shareOrDownload(new File([photo.file], fileName(photo, photo.file.name), { type: photo.file.type || 'image/jpeg' }))
  if (!photo.url) throw new Error('Foto sem arquivo original')
  const res = await fetch(photo.url)
  if (!res.ok) throw new Error('Falha ao baixar')
  const blob = await res.blob()
  return shareOrDownload(new File([blob], fileName(photo, new URL(photo.url).pathname), { type: blob.type || 'image/jpeg' }))
}

export async function shareOrDownload(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
