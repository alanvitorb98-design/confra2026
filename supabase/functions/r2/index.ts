// Full-quality originals on Cloudflare R2 (10 GB free, no download fees). The phone never sees the R2 keys:
// it asks here for a short-lived link, checked against its login, and talks to R2 directly with it.
// Paths are the same as in the app's bucket (party|look/<guest id>/<photo id>.<ext>); photos.on_r2 says where.
//   op=status         anyone: is R2 ready (keys set and the bucket accepts the app's site)?
//   op=put   (POST)   a guest, only into their own folder                               -> 10-minute upload link
//   op=get   (POST)   a guest, a photo still in the app (or anything in their own folder);
//                     organizers any photo (for "Baixar todas")                         -> 10-minute download link
//   op=setup (POST)   organizers: lets the app's site talk to the bucket (CORS; needs an admin R2 key)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1.0.20'

const BUCKET = 'confra-fotos'
const TTL = 600
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

async function guestOf(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  const { data } = await db.auth.getUser(jwt)
  if (!data.user) return null
  const { data: g } = await db.from('guests').select('id, is_admin').eq('user_id', data.user.id).maybeSingle()
  return g as { id: string; is_admin: boolean } | null
}

async function signed(path: string, method: 'GET' | 'PUT') {
  const u = new URL(`${endpoint}/${BUCKET}/${path}`)
  u.searchParams.set('X-Amz-Expires', String(TTL))
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
  const me = await guestOf(req)
  if (!me) return json({ error: 'faça login' }, 401)

  if (op === 'setup') {
    if (!me.is_admin) return json({ error: 'só organizador' }, 403)
    const rules = SITES.map((o) => `<CORSRule><AllowedOrigin>${o}</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedHeader>*</AllowedHeader><MaxAgeSeconds>86400</MaxAgeSeconds></CORSRule>`).join('')
    const res = await r2.fetch(`${endpoint}/${BUCKET}?cors`, { method: 'PUT', body: `<CORSConfiguration>${rules}</CORSConfiguration>`, headers: { 'Content-Type': 'application/xml' } })
    corsAt = 0
    return res.ok ? json({ ok: true }) : json({ error: `r2 ${res.status}`, detail: (await res.text()).slice(0, 300) }, 502)
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
