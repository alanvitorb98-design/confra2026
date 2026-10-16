// Health of the services. pg_cron calls this every 5 minutes: it measures (saude_medir), compares with the
// last check and, when something gets worse or goes back to normal, pushes a notice to the organizers' phones.
// Public on purpose: calling it again only re-checks, and a notice goes out only when a status changes.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const APP = 'Confra'
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Check = { item: string; status: 'ok' | 'atencao' | 'critico'; texto: string }
const RANK = { ok: 0, atencao: 1, critico: 2 }

Deno.serve(async () => {
  const { data: now, error } = await db.rpc('saude_medir')
  if (error) return json({ error: error.message }, 500)
  const checks = (now ?? []) as Check[]
  const { data: before } = await db.from('saude_estado').select('item, status')
  const last = new Map((before ?? []).map((r) => [r.item, r.status as Check['status']]))

  const worse = checks.filter((c) => RANK[c.status] > RANK[last.get(c.item) ?? 'ok'])
  const back = checks.filter((c) => c.status === 'ok' && (last.get(c.item) ?? 'ok') !== 'ok')
  const changed = checks.filter((c) => c.status !== (last.get(c.item) ?? 'ok') || !last.has(c.item))
  if (changed.length)
    await db.from('saude_estado').upsert(changed.map((c) => ({ item: c.item, status: c.status, texto: c.texto, desde: new Date().toISOString() })))

  if (!worse.length && !back.length) return json({ checks, sent: 0 })

  const worst = worse.some((c) => c.status === 'critico') ? 'critico' : worse.length ? 'atencao' : 'ok'
  const title = worst === 'critico' ? `🚨 ${APP}: problema` : worst === 'atencao' ? `⚠️ ${APP}: atenção` : `✅ ${APP}: normalizou`
  const body = [...worse, ...back].map((c) => c.texto).join('\n')

  const { data: secret } = await db.from('event_secret').select('vapid_public, vapid_private').single()
  if (!secret?.vapid_private) return json({ checks, error: 'sem chaves de aviso' }, 503)
  webpush.setVapidDetails('mailto:saude@convidados.app', secret.vapid_public, secret.vapid_private)
  const { data: admins } = await db.from('guests').select('id').eq('is_admin', true)
  const { data: subs } = await db
    .from('push_subs')
    .select('endpoint, p256dh, auth')
    .is('removed_at', null)
    .in('guest_id', (admins ?? []).map((a) => a.id))
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, tag: 'saude' }), { TTL: 3600, urgency: 'high' })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await db.from('push_subs').update({ removed_at: new Date().toISOString() }).eq('endpoint', s.endpoint)
    }
  }
  return json({ checks, title, body, sent })
})
