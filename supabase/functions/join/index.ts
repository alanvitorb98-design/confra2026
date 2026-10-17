// Entry to the party: creates a real login for the guest. Open to anyone with the link (no QR code needed),
// with limits per network and in total so nobody can flood it with fake guests.
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL_ = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const ORIGINS = ['https://alanvitorb98-design.github.io', 'http://localhost:4175', 'http://localhost:5173']
// the party wifi puts many guests behind one address
const MAX_JOINS_PER_HOUR = 600
const MAX_GUESTS = 1500
// códigos de volta tried per network before it has to wait (the whole party can share one wifi address),
// and by everyone together: guessers spread over many networks still get about 2,000 tries an hour against
// 190 million codes
const MAX_BACK_TRIES_PER_HOUR = 200
const MAX_BACK_TRIES_TOTAL = 2000

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
})

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = { ...cors(origin), 'Content-Type': 'application/json' }
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return reply(405, { error: 'method' })

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'json' })
  }

  const since = new Date(Date.now() - 3600_000).toISOString()

  // a one-time sign-in made and used right here (no email is sent): the guest's other phones stay signed in
  const signInAs = async (userId: string) => {
    const { data: u } = await admin.auth.admin.getUserById(userId)
    if (!u.user?.email) return null
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email })
    const hash = link?.properties?.hashed_token
    if (linkError || !hash) return null
    const { data: signed, error: signError } = await createClient(URL_, ANON, { auth: { persistSession: false } }).auth.verifyOtp({ token_hash: hash, type: 'magiclink' })
    return signError ? null : signed.session
  }

  // back into an existing account with its código de volta (another phone, browser, or cleared data)
  if (typeof body.back === 'string') {
    const tag = `volta:${ip}`
    // each try is written down before counting: tries sent all at once each count the others
    await admin.from('join_attempts').insert({ ip: tag })
    const [{ count: tries }, { count: all }] = await Promise.all([
      admin.from('join_attempts').select('*', { count: 'exact', head: true }).eq('ip', tag).gte('at', since),
      admin.from('join_attempts').select('*', { count: 'exact', head: true }).like('ip', 'volta:%').gte('at', since),
    ])
    if ((tries ?? 0) > MAX_BACK_TRIES_PER_HOUR || (all ?? 0) > MAX_BACK_TRIES_TOTAL) return reply(429, { error: 'muitas tentativas' })
    const code = body.back.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const { data: hit } = code.length === 6 ? await admin.from('guest_codes').select('guest_id').eq('code', code).maybeSingle() : { data: null }
    const { data: g } = hit
      ? await admin.from('guests').select('id, name, instagram, face_opt_in, user_id').eq('id', hit.guest_id).maybeSingle()
      : { data: null }
    if (!g?.user_id) return reply(404, { error: 'código' })
    const session = await signInAs(g.user_id)
    if (!session) return reply(500, { error: 'sessao' })
    return reply(200, {
      guest_id: g.id,
      name: g.name,
      instagram: g.instagram,
      face: g.face_opt_in,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
  }

  // written down before counting, like the códigos de volta
  await admin.from('join_attempts').insert({ ip })
  const { count } = await admin.from('join_attempts').select('*', { count: 'exact', head: true }).eq('ip', ip).gte('at', since)
  if ((count ?? 0) > MAX_JOINS_PER_HOUR) return reply(429, { error: 'muitas tentativas' })
  const { count: guests } = await admin.from('guests').select('*', { count: 'exact', head: true })
  if ((guests ?? 0) >= MAX_GUESTS) return reply(429, { error: 'lotado' })

  const name = String(body.name ?? '').trim()
  const instagram = String(body.instagram ?? '').replace(/^@/, '').trim()
  if (name.length < 2 || name.length > 40) return reply(400, { error: 'nome' })
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) return reply(400, { error: 'instagram' })
  // which version of the terms the guest accepted on the opening screen (kept as proof of consent)
  const terms = typeof body.terms === 'string' && /^[\w.-]{1,20}$/.test(body.terms) ? body.terms : null

  // the same sign-up sent again (its answer was lost on the way): the guest it already made, not a second one.
  // The key is the phone's own and works for 10 minutes only.
  const key = typeof body.key === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.key) ? body.key : null
  let keyMine = false
  if (key) {
    const { error: keyError } = await admin.from('join_keys').insert({ key })
    keyMine = !keyError
    if (keyError) {
      // the first try may still be making the guest: wait for it a little
      for (let i = 0; i < 10; i++) {
        const { data: k } = await admin.from('join_keys').select('guest_id, created_at').eq('key', key).maybeSingle()
        if (!k || Date.now() - Date.parse(k.created_at) > 10 * 60_000) break
        if (k.guest_id) {
          const { data: g } = await admin.from('guests').select('id, name, user_id').eq('id', k.guest_id).maybeSingle()
          const session = g?.user_id ? await signInAs(g.user_id) : null
          if (!session) break
          return reply(200, { guest_id: g!.id, name: g!.name, access_token: session.access_token, refresh_token: session.refresh_token })
        }
        await new Promise((r) => setTimeout(r, 500))
      }
    }
  }

  const email = `${crypto.randomUUID()}@convidados.confra`
  const password = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
  const { data: created, error: userError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (userError || !created.user) return reply(500, { error: 'conta' })

  const { data: guest, error: guestError } = await admin
    .from('guests')
    .insert({
      name,
      instagram: instagram || null,
      face_opt_in: body.face === true,
      user_id: created.user.id,
      terms_version: terms,
      terms_at: terms ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (guestError) return reply(500, { error: 'convidado' })
  if (keyMine) await admin.from('join_keys').update({ guest_id: guest.id }).eq('key', key)

  const { data: signed, error: signError } = await createClient(URL_, ANON, { auth: { persistSession: false } }).auth.signInWithPassword({ email, password })
  if (signError || !signed.session) return reply(500, { error: 'sessao' })

  return reply(200, {
    guest_id: guest.id,
    access_token: signed.session.access_token,
    refresh_token: signed.session.refresh_token,
  })
})
