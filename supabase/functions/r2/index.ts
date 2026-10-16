// Full-quality originals on Cloudflare R2 (10 GB free, no download fees). The phone never sees the R2 keys:
// it asks here for a short-lived link, checked against its login, and talks to R2 directly with it.
// Paths are the same as in the app's bucket (party|look/<guest id>/<photo id>.<ext>); photos.on_r2 says where.
//   op=status         anyone: is R2 ready (keys set and the bucket accepts the app's site)?
//   op=put   (POST)   a guest, only into their own folder                               -> 10-minute upload link
//   op=get   (POST)   a guest, a photo still in the app (or anything in their own folder);
//                     organizers any photo (for "Baixar todas")                         -> 10-minute download link
//   op=setup (POST)   organizers: lets the app's site talk to the bucket (CORS; needs an admin R2 key)
//   op=put-many (POST {paths}) a guest, own folder: upload links for a photo's original, 1080px copy and
//                     thumbnail at once; the copies' 7-day viewing links wait in r2_links for the photo row
//   op=renew (POST)   anyone (daily job): signs again the viewing links that expire within 2 days
import { createClient } from 'npm:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1.0.20'

const BUCKET = 'confra-fotos'
const TTL = 600
// viewing links for the light copies: R2's longest, renewed daily by op=renew
const VIEW_TTL = 7 * 86400
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  const op = url.searchParams.get('op')
  if (op === 'status') return json({ ready: await ready(), keys })
  if (!r2) return json({ error: 'R2 ainda não configurado' }, 503)
  if (req.method !== 'POST') return json({ error: 'use POST' }, 405)

  if (op === 'renew') {
    const soon = new Date(Date.now() + 2 * 86400_000).toISOString()
    const { data: rows } = await db
      .from('photos')
      .select('id, preview_path')
      .not('preview_url', 'is', null)
      .is('removed_at', null)
      .lt('links_until', soon)
      .limit(3000)
    const until = new Date(Date.now() + VIEW_TTL * 1000).toISOString()
    for (const r of rows ?? []) {
      const preview = await signed(r.preview_path, 'GET', VIEW_TTL)
      const thumb = await signed(r.preview_path.replace(/-p\.jpg$/, '-t.jpg'), 'GET', VIEW_TTL)
      await db.from('photos').update({ preview_url: preview, thumb_url: thumb, links_until: until }).eq('id', r.id)
    }
    return json({ renewed: rows?.length ?? 0 })
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
    const body = (await req.json().catch(() => ({}))) as { paths?: unknown }
    const paths = Array.isArray(body.paths) ? body.paths.filter((p): p is string => typeof p === 'string').slice(0, 4) : []
    const out: Record<string, { url?: string; exists?: boolean }> = {}
    const views: Record<string, Record<string, string>> = {}
    for (const p of paths) {
      const m = PATH.exec(p) ?? LIGHT.exec(p)
      if (!m || m[2] !== me.id) return json({ error: 'só na sua pasta' }, 403)
      // never overwrite: a retry after a half-finished upload finds the file already there
      const head = await r2.fetch(`${endpoint}/${BUCKET}/${p}`, { method: 'HEAD' })
      out[p] = head.ok ? { exists: true } : { url: await signed(p, 'PUT') }
      const light = LIGHT.exec(p)
      if (light) (views[light[3]] ??= {})[light[4] === 'p' ? 'preview' : 'thumb'] = await signed(p, 'GET', VIEW_TTL)
    }
    const until = new Date(Date.now() + VIEW_TTL * 1000).toISOString()
    for (const [id, v] of Object.entries(views)) await db.from('r2_links').upsert({ id, guest_id: me.id, until, ...v })
    return json({ paths: out })
  }

  const path = url.searchParams.get('path') ?? ''
  const m = PATH.exec(path)
  if (!m) return json({ error: 'caminho inválido' }, 400)
  const own = m[2] === me.id

  if (op === 'put') {
    if (!own) return json({ error: 'só na sua pasta' }, 403)
    // never overwrite: a retry after a half-finished upload finds the file already there
    const head = await r2.fetch(`${endpoint}/${BUCKET}/${path}`, { method: 'HEAD' })
    if (head.ok) return json({ exists: true })
    return json({ url: await signed(path, 'PUT') })
  }

  if (op === 'get') {
    if (!own && !me.is_admin) {
      const { data: p } = await db.from('photos').select('id').eq('original_path', path).eq('on_r2', true).eq('test', false).is('removed_at', null).maybeSingle()
      if (!p) return json({ error: 'foto não disponível' }, 404)
    }
    return json({ url: await signed(path, 'GET') })
  }

  return json({ error: 'operação inválida' }, 400)
})
