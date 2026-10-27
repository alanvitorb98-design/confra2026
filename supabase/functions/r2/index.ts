// Full-quality originals on Cloudflare R2 (10 GB free, no download fees). The phone never sees the R2 keys:
// it asks here for a short-lived link, checked against its login, and talks to R2 directly with it.
// Paths are the same as in the app's bucket (party|look/<guest id>/<photo id>.<ext>); photos.on_r2 says where.
//   op=status         anyone: is R2 ready (keys set and the bucket accepts the app's site)?
//   op=get   (POST)   a guest, a photo still in the app (or anything in their own folder);
//                     organizers any photo (for "Baixar todas")                         -> 10-minute download link
//   op=setup (POST)   organizers: lets the app's site talk to the bucket (CORS; needs an admin R2 key)
//   op=put-many (POST {files: [{path, size, type}]}) a guest, own folder: upload links for a photo's original,
//                     1080px copy and thumbnail at once, each only good for that exact size and type; the copies'
//                     7-day viewing links wait in r2_links for the photo row
//   op=renew (POST)   anyone (daily job): signs again the viewing links that expire within 2 days
//   op=forget (POST)  anyone (daily job): deletes from the app's bucket the files the database queued in
//                     apagar_arquivos (selfies after the party or when a guest leaves the recognition)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { AwsClient, AwsV4Signer } from 'npm:aws4fetch@1.0.20'

const BUCKET = 'confra-fotos'
const TTL = 600
// viewing links for the light copies: R2's longest, renewed daily by op=renew
const VIEW_TTL = 7 * 86400
// the same limits as the app's bucket: 25 MB a photo, 300 MB a guest; the light copies are small JPEGs
const MAX = 25 * 1024 * 1024
const MAX_LIGHT = 3 * 1024 * 1024
const QUOTA = 300 * 1024 * 1024
const TYPES = /^image\/(jpeg|png|webp|heic|heif)$/
const SITES = ['https://alanvitorb98-design.github.io', 'http://localhost:4175', 'http://localhost:5173']
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const endpoint = (Deno.env.get('R2_ENDPOINT') ?? '').trim().replace(/\/+$/, '').replace(/\/confra-fotos$/, '')
const key = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim()
const secret = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim()
const keys = !!(endpoint && key && secret)
const r2 = keys ? new AwsClient({ accessKeyId: key, secretAccessKey: secret, service: 's3', region: 'auto' }) : null

// phones upload straight to R2, so the bucket must accept the site (CORS); until it does, the app keeps
// using its own bucket instead of failing uploads
let corsOk = false
let corsAt = 0
async function ready() {
  if (!keys) return false
  if (corsOk || Date.now() - corsAt < 60_000) return corsOk
  corsAt = Date.now()
  try {
    const res = await fetch(`${endpoint}/${BUCKET}/ping.jpg`, { method: 'OPTIONS', headers: { Origin: SITES[0], 'Access-Control-Request-Method': 'PUT' } })
    corsOk = !!res.headers.get('access-control-allow-origin')
  } catch {
    corsOk = false
  }
  return corsOk
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const PATH = /^(party|look)\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpe?g|png|heic|heif|webp)$/i
// the light copies next to an original: <photo id>-p.jpg (1080px) and <photo id>-t.jpg (thumbnail)
const LIGHT = /^(party|look)\/([0-9a-f-]{36})\/([0-9a-f-]{36})-(p|t)\.jpg$/i

async function guestOf(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  const { data } = await db.auth.getUser(jwt)
  if (!data.user) return null
  const { data: g } = await db.from('guests').select('id, is_admin').eq('user_id', data.user.id).maybeSingle()
  return g as { id: string; is_admin: boolean } | null
}

async function signed(path: string, method: 'GET' | 'PUT', ttl = TTL) {
  const u = new URL(`${endpoint}/${BUCKET}/${path}`)
  u.searchParams.set('X-Amz-Expires', String(ttl))
  const req = await r2!.sign(new Request(u, { method }), { aws: { signQuery: true } })
  return req.url
}

// an upload link that R2 only takes for this size and type, so a phone can't put anything bigger through it
async function signedPut(path: string, size: number, type: string) {
  const u = new URL(`${endpoint}/${BUCKET}/${path}`)
  u.searchParams.set('X-Amz-Expires', String(TTL))
  const s = new AwsV4Signer({
    url: u.toString(), method: 'PUT', headers: { 'content-length': String(size), 'content-type': type },
    accessKeyId: key, secretAccessKey: secret, service: 's3', region: 'auto', signQuery: true, allHeaders: true,
  })
  return (await s.sign()).url.toString()
}

// how much a guest already keeps on R2, both folders
async function used(guest: string) {
  let total = 0
  for (const kind of ['party', 'look']) {
    let token = ''
    for (let page = 0; page < 10; page++) {
      const u = new URL(`${endpoint}/${BUCKET}`)
      u.searchParams.set('list-type', '2')
      u.searchParams.set('prefix', `${kind}/${guest}/`)
      if (token) u.searchParams.set('continuation-token', token)
      const res = await r2!.fetch(u.toString())
      if (!res.ok) throw new Error(`r2 list ${res.status}`)
      const xml = await res.text()
      for (const m of xml.matchAll(/<Size>(\d+)<\/Size>/g)) total += Number(m[1])
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] ?? '') : ''
      if (!token) break
    }
  }
  return total
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  const op = url.searchParams.get('op')
  if (op === 'status') return json({ ready: await ready(), keys })
  // only paths the database queued are deleted, so anyone may ask; works without R2 too
  if (op === 'forget' && req.method === 'POST') {
    let removed = 0
    for (let page = 0; page < 20; page++) {
      const { data: rows } = await db.from('apagar_arquivos').select('path').order('at').limit(500)
      const paths = (rows ?? []).map((r) => r.path as string)
      if (!paths.length) break
      const { error } = await db.storage.from('fotos').remove(paths)
      if (error) return json({ error: error.message, removed }, 500)
      // in pieces: 500 paths in one address are about 40 KB, which the server refuses (400), and the same
      // rows came back every time, so a big clean-up never got past its first 500 files
      for (let i = 0; i < paths.length; i += 100) {
        const { error: queueError } = await db.from('apagar_arquivos').delete().in('path', paths.slice(i, i + 100))
        if (queueError) return json({ error: queueError.message, removed }, 500)
      }
      removed += paths.length
      if (paths.length < 500) break
    }
    return json({ removed })
  }
  if (!r2) return json({ error: 'R2 ainda não configurado' }, 503)
  if (req.method !== 'POST') return json({ error: 'use POST' }, 405)

  if (op === 'renew') {
    const soon = new Date(Date.now() + 2 * 86400_000).toISOString()
    const until = new Date(Date.now() + VIEW_TTL * 1000).toISOString()
    let renewed = 0
    // a page at a time: renewed rows leave the filter, so the next page is the next batch
    for (let page = 0; page < 20; page++) {
      const { data: rows } = await db
        .from('photos')
        .select('id, preview_path')
        .not('preview_url', 'is', null)
        .is('removed_at', null)
        .lt('links_until', soon)
        .order('id')
        .limit(500)
      for (const r of rows ?? []) {
        const preview = await signed(r.preview_path, 'GET', VIEW_TTL)
        const thumb = await signed(r.preview_path.replace(/-p\.jpg$/, '-t.jpg'), 'GET', VIEW_TTL)
        await db.from('photos').update({ preview_url: preview, thumb_url: thumb, links_until: until }).eq('id', r.id)
      }
      renewed += rows?.length ?? 0
      if ((rows?.length ?? 0) < 500) break
    }
    return json({ renewed })
  }
  const me = await guestOf(req)
  if (!me) return json({ error: 'faça login' }, 401)

  if (op === 'setup') {
    if (!me.is_admin) return json({ error: 'só organizador' }, 403)
    const rules = SITES.map((o) => `<CORSRule><AllowedOrigin>${o}</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedHeader>*</AllowedHeader><MaxAgeSeconds>86400</MaxAgeSeconds></CORSRule>`).join('')
    const res = await r2.fetch(`${endpoint}/${BUCKET}?cors`, { method: 'PUT', body: `<CORSConfiguration>${rules}</CORSConfiguration>`, headers: { 'Content-Type': 'application/xml' } })
    corsAt = 0
    return res.ok ? json({ ok: true }) : json({ error: `r2 ${res.status}`, detail: (await res.text()).slice(0, 300) }, 502)
  }

  if (op === 'put-many') {
    const body = (await req.json().catch(() => ({}))) as { files?: unknown }
    // an app from before the size check: it falls back to the app's bucket, which has its own limits
    if (!Array.isArray(body.files)) return json({ error: 'atualize o app' }, 400)
    const files = (body.files as { path?: unknown; size?: unknown; type?: unknown }[]).slice(0, 4)
    const out: Record<string, { url?: string; exists?: boolean }> = {}
    const views: Record<string, Record<string, string>> = {}
    const todo: { path: string; size: number; type: string }[] = []
    for (const f of files) {
      const p = typeof f?.path === 'string' ? f.path : ''
      const size = typeof f?.size === 'number' && Number.isInteger(f.size) ? f.size : 0
      const type = typeof f?.type === 'string' ? f.type : ''
      const light = LIGHT.exec(p)
      const m = PATH.exec(p) ?? light
      if (!m || m[2] !== me.id) return json({ error: 'só na sua pasta' }, 403)
      if (size < 1 || size > (light ? MAX_LIGHT : MAX)) return json({ error: 'foto grande demais' }, 413)
      if (light ? type !== 'image/jpeg' : !TYPES.test(type)) return json({ error: 'formato não aceito' }, 415)
      // never overwrite: a retry after a half-finished upload finds the file already there
      const head = await r2.fetch(`${endpoint}/${BUCKET}/${p}`, { method: 'HEAD' })
      if (head.ok) out[p] = { exists: true }
      else todo.push({ path: p, size, type })
      if (light) (views[light[3]] ??= {})[light[4] === 'p' ? 'preview' : 'thumb'] = await signed(p, 'GET', VIEW_TTL)
    }
    if (todo.length && (await used(me.id)) + todo.reduce((n, f) => n + f.size, 0) > QUOTA) return json({ error: 'espaço de fotos cheio' }, 413)
    for (const f of todo) out[f.path] = { url: await signedPut(f.path, f.size, f.type) }
    const until = new Date(Date.now() + VIEW_TTL * 1000).toISOString()
    for (const [id, v] of Object.entries(views)) await db.from('r2_links').upsert({ id, guest_id: me.id, until, ...v })
    return json({ paths: out })
  }

  const path = url.searchParams.get('path') ?? ''
  const m = PATH.exec(path)
  if (!m) return json({ error: 'caminho inválido' }, 400)
  const own = m[2] === me.id

  if (op === 'get') {
    if (!own && !me.is_admin) {
      const { data: p } = await db.from('photos').select('id').eq('original_path', path).eq('on_r2', true).eq('test', false).is('removed_at', null).maybeSingle()
      if (!p) return json({ error: 'foto não disponível' }, 404)
    }
    return json({ url: await signed(path, 'GET') })
  }

  return json({ error: 'operação inválida' }, 400)
})
