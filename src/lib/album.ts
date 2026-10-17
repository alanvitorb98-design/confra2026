import { zipSync } from 'fflate'
import { db, readOriginal } from './backend'
import { everyRow } from './ids'
import { BRAND } from '../brand/brand'

// "Baixar todas as fotos" in the organizer panel: every photo still in the app, full quality,
// in zip files of about 100 MB (photos are already compressed, so the zip only stores them). A part is held
// in memory about three times while it is zipped, and a phone's browser tab can't hold much more than that.
const PART = 100 * 1024 * 1024

interface Row {
  id: string
  guest_id: string
  kind: 'party' | 'look'
  original_path: string
  on_r2: boolean
  created_at: string
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'convidado'

function save(files: Record<string, Uint8Array>, part: number) {
  const zip = zipSync(files, { level: 0 })
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${BRAND.slug}-fotos-${String(part).padStart(2, '0')}.zip`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Downloads everything; reports progress as (done, total). Returns how many photos could not be read. */
export async function downloadAll(onProgress: (done: number, total: number) => void) {
  // page by page: the server answers at most 1000 rows at a time, and the album must have every photo
  const [{ data: photos, error }, { data: people }] = await Promise.all([
    everyRow<Row>((a, b) => db.from('photos').select('id,guest_id,kind,original_path,on_r2,created_at').is('removed_at', null).eq('test', false).order('created_at').order('id').range(a, b)),
    everyRow<{ id: string; name: string }>((a, b) => db.from('guests').select('id,name').order('id').range(a, b)),
  ])
  if (error || !photos) throw new Error('não consegui listar as fotos')
  const names = new Map((people ?? []).map((g: { id: string; name: string }) => [g.id, slug(g.name)]))
  const rows = photos as Row[]
  let files: Record<string, Uint8Array> = {}
  let size = 0
  let part = 1
  let missing = 0
  for (const [i, p] of rows.entries()) {
    try {
      const blob = p.on_r2
        ? await readOriginal(p.original_path)
        : await db.storage.from('fotos').download(p.original_path).then(({ data, error }) => {
            if (error || !data) throw error ?? new Error('sem arquivo')
            return data
          })
      const ext = /\.[a-z0-9]{2,5}$/i.exec(p.original_path)?.[0] ?? '.jpg'
      const stamp = new Date(p.created_at).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(/[-: ]/g, '').slice(0, 14)
      const folder = p.kind === 'look' ? 'looks' : 'festa'
      files[`${folder}/${stamp}-${names.get(p.guest_id) ?? 'convidado'}-${p.id.slice(0, 6)}${ext}`] = new Uint8Array(await blob.arrayBuffer())
      size += blob.size
    } catch {
      missing++
    }
    if (size >= PART) {
      save(files, part++)
      files = {}
      size = 0
    }
    onProgress(i + 1, rows.length)
  }
  if (Object.keys(files).length) save(files, part)
  return missing
}
