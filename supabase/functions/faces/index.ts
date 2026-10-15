// Work queue for the face server (a private Hugging Face Space running InsightFace).
// Custom auth: the server sends its password, checked against the hash the organizer generated in the panel.
// The server never holds a database key: it gets 5-minute links to light copies and sends back numbers only.
import { createClient } from 'npm:@supabase/supabase-js@2'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const BUCKET = 'fotos'
const LINK_TTL = 300

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('')
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const analysisPath = (original: string) => original.replace(/\.[^./]+$/, '') + '-f.jpg'

async function link(path: string) {
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, LINK_TTL)
  return data?.signedUrl ?? null
}

Deno.serve(async (req) => {
  const secret = req.headers.get('x-face-secret') ?? ''
  const { data: s } = await db.from('event_secret').select('face_hash').single()
  if (!s?.face_hash || secret.length < 32 || (await sha256(secret)) !== s.face_hash) return json(401, { error: 'senha' })
  await db.from('event_config').update({ face_worker_seen: new Date().toISOString() }).eq('id', true)

  const op = new URL(req.url).searchParams.get('op')

  if (op === 'queue') {
    const jobs: { kind: 'selfie' | 'photo'; id: string; url: string }[] = []
    const { data: selfies } = await db.from('guests').select('id,selfie_path').eq('face_status', 'pending').not('selfie_path', 'is', null).limit(4)
    for (const g of selfies ?? []) {
      const url = await link(g.selfie_path)
      if (url) jobs.push({ kind: 'selfie', id: g.id, url })
      else await db.from('guests').update({ face_status: 'failed' }).eq('id', g.id)
    }
    // photos wait until someone has a selfie to look for
    const { count } = await db.from('face_refs').select('guest_id', { count: 'exact', head: true }).not('embedding', 'is', null)
    if ((count ?? 0) > 0) {
      const { data: photos } = await db
        .from('photos')
        .select('id,original_path,preview_path')
        .eq('faces_status', 'pending').eq('kind', 'party').is('removed_at', null)
        .order('created_at').limit(6)
      for (const p of photos ?? []) {
        const url = (await link(analysisPath(p.original_path))) ?? (await link(p.preview_path))
        if (url) jobs.push({ kind: 'photo', id: p.id, url })
        else await db.from('photos').update({ faces_status: 'failed' }).eq('id', p.id)
      }
    }
    return json(200, { jobs })
  }

  if (op === 'save' && req.method === 'POST') {
    const body = (await req.json()) as { kind: string; id: string; embeddings: number[][]; boxes?: number[][] }
    const ok = (e: unknown) => Array.isArray(e) && e.length === 512 && e.every((x) => typeof x === 'number' && Number.isFinite(x))
    // where each face is, in fractions of the photo [x, y, w, h] (older workers send none)
    const box = (b: unknown) =>
      Array.isArray(b) && b.length === 4 && b.every((x) => typeof x === 'number' && Number.isFinite(x)) ? b.map((x: number) => Math.min(1, Math.max(0, x))) : null
    const boxes = Array.isArray(body.boxes) ? body.boxes : []
    const faces = (Array.isArray(body.embeddings) ? body.embeddings : []).map((e, i) => ({ e, b: box(boxes[i]) })).filter((f) => ok(f.e)).slice(0, 40)
    const embeddings = faces.map((f) => f.e)
    if (body.kind === 'selfie') {
      const { data: g } = await db.from('guests').select('selfie_path').eq('id', body.id).single()
      const { error } = await db.rpc('face_save_selfie', { p_guest: body.id, p_embedding: embeddings[0] ?? null })
      if (error) return json(500, { error: error.message })
      // the selfie photo itself is not kept: only its numbers
      if (g?.selfie_path) await db.storage.from(BUCKET).remove([g.selfie_path])
      await db.from('guests').update({ selfie_path: null }).eq('id', body.id)
      return json(200, { ok: true })
    }
    if (body.kind === 'photo') {
      const { data: p } = await db.from('photos').select('original_path').eq('id', body.id).single()
      const { data, error } = await db.rpc('face_save_faces', { p_photo: body.id, p_faces: faces, p_threshold: 0.42 })
      if (error) return json(500, { error: error.message })
      if (p?.original_path) await db.storage.from(BUCKET).remove([analysisPath(p.original_path)])
      return json(200, { matched: data })
    }
  }

  if (op === 'fail' && req.method === 'POST') {
    const body = (await req.json()) as { kind: string; id: string }
    if (body.kind === 'selfie') await db.from('guests').update({ face_status: 'failed' }).eq('id', body.id)
    if (body.kind === 'photo') await db.from('photos').update({ faces_status: 'failed' }).eq('id', body.id)
    return json(200, { ok: true })
  }

  return json(400, { error: 'op' })
})
