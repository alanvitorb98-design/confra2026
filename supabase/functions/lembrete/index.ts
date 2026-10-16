// Countdown reminders by web push. A pg_cron job calls this every hour; it decides whether a reminder is
// due (one a day at 9h, "o app abriu", "começou") and the push_log table makes sure each goes out once.
// Public on purpose: calling it twice sends nothing new. op=test sends one sample to the caller's own phone,
// which has to prove it is that phone with its own push keys.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const TZ = 'America/Sao_Paulo'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })
const hourOf = (d: Date) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(d))
const hm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(':00', 'h').replace(':', 'h')
const dm = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ })

type Msg = { key: string; title: string; body: string }

const EXTRAS = [
  'Já pensou no look? Vai ter mural só pra ele.',
  'Vai ter missões de foto e ranking. Se prepara!',
  'Bora contar os dias.',
  'As fotos ficam todas no app pra baixar depois.',
  'Chama a galera, vai ser bom demais.',
]

/** The reminder for this moment, or null. With force (test) it ignores the hour and the log. */
function pick(c: Record<string, string>, now: Date, force = false): Msg | null {
  const opens = new Date(c.app_opens)
  const start = new Date(c.party_starts)
  const today = ymd(now)
  const days = Math.round((Date.parse(ymd(start)) - Date.parse(today)) / 86_400_000)
  const h = hourOf(now)

  if (now >= start && now.getTime() < start.getTime() + 2 * 3600_000)
    return { key: 'comecou', title: 'A festa começou! 🥂', body: 'Câmera e missões liberadas. Bora fotografar!' }
  if (now >= opens && now < start)
    return { key: 'abriu', title: 'O app da Confra abriu! 📸', body: 'Entra e faz seu cadastro. Amanhã cedo abre o mural de looks.' }
  if (days < 0 || (!force && (h < 9 || h >= 21))) return null

  const key = `dia-${today}`
  if (days === 0) return { key, title: 'É hoje! 🎉', body: `A Confra da Firma começa às ${hm(start)}. O mural de looks já está aberto.` }
  if (days === 1)
    return {
      key,
      title: 'É amanhã! 🎉',
      body: ymd(opens) === today ? `Confra da Firma amanhã às ${hm(start)}. O app abre hoje às ${hm(opens)} pra você se cadastrar.` : `Confra da Firma amanhã às ${hm(start)}.`,
    }
  return { key, title: `Faltam ${days} dias pra Confra da Firma`, body: `${dm(start)} às ${hm(start)}. ${EXTRAS[days % EXTRAS.length]}` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const input = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

  const [{ data: cfg }, { data: secret }] = await Promise.all([
    db.from('event_config').select('app_opens, party_starts').single(),
    db.from('event_secret').select('vapid_public, vapid_private').single(),
  ])
  if (!cfg || !secret?.vapid_private) return json({ error: 'sem configuração' }, 503)
  webpush.setVapidDetails('mailto:confra@convidados.confra', secret.vapid_public, secret.vapid_private)

  const send = (s: { endpoint: string; p256dh: string; auth: string }, m: Msg) =>
    webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: m.title, body: m.body, tag: 'confra' }), { TTL: 6 * 3600 })

  if (input.op === 'test') {
    const { data: sub } = await db
      .from('push_subs')
      .select('endpoint, p256dh, auth')
      .eq('endpoint', String(input.endpoint ?? ''))
      .eq('auth', String(input.auth ?? ''))
      .is('removed_at', null)
      .maybeSingle()
    if (!sub) return json({ error: 'aviso não ligado neste celular' }, 404)
    const m = pick(cfg, new Date(), true) ?? { key: 'teste', title: 'Confra da Firma', body: 'Os avisos estão funcionando.' }
    try {
      await send(sub, m)
      return json({ ok: true })
    } catch (e) {
      return json({ error: String((e as { statusCode?: number }).statusCode ?? e) }, 502)
    }
  }

  const m = pick(cfg, new Date())
  if (!m) return json({ due: null })
  const { error: dup } = await db.from('push_log').insert({ key: m.key })
  if (dup) return json({ due: m.key, already: true })

  const { data: subs } = await db.from('push_subs').select('endpoint, p256dh, auth').is('removed_at', null)
  let sent = 0
  const gone: string[] = []
  for (const s of subs ?? []) {
    try {
      await send(s, m)
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) gone.push(s.endpoint)
    }
  }
  if (gone.length) await db.from('push_subs').update({ removed_at: new Date().toISOString() }).in('endpoint', gone)
  await db.from('push_log').update({ sent }).eq('key', m.key)
  return json({ due: m.key, sent, gone: gone.length })
})
