// Starts the face worker (GitHub Actions) on time. GitHub's own schedule runs late or skips on the free
// plan, so the database's clock (pg_cron) calls this instead. Needs the GH_DISPATCH_TOKEN secret: a
// fine-grained token with Actions read and write on the confra2026 repository only.
// ?op=drain clears the queue and stops; ?op=party works for 345 minutes (only on the party day).
// The URL is public, so the database (rostos_allow) decides how often each op may reach GitHub.
const TOKEN = Deno.env.get('GH_DISPATCH_TOKEN') ?? ''
const DB = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const URL_ = 'https://api.github.com/repos/alanvitorb98-design/confra2026/actions/workflows/faces-worker.yml/dispatches'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Brasília (UTC-3) date and minutes since midnight
function brasilia(now = new Date()) {
  const t = new Date(now.getTime() - 3 * 3600_000)
  return { day: t.toISOString().slice(0, 10), min: t.getUTCHours() * 60 + t.getUTCMinutes() }
}

async function allowed(op: string) {
  const res = await fetch(`${DB}/rest/v1/rpc/rostos_allow`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_op: op }),
  })
  return res.ok && (await res.json()) === true
}

Deno.serve(async (req) => {
  const op = new URL(req.url).searchParams.get('op')
  if (!TOKEN) return json(503, { error: 'GH_DISPATCH_TOKEN missing' })
  if (op !== 'party' && op !== 'drain' && op !== 'check') return json(400, { error: 'op' })
  const { day, min } = brasilia()
  const partyDay = day === '2026-11-07'
  let minutes: string
  if (op === 'party') {
    if (!partyDay) return json(200, { skipped: 'not the party day' })
    minutes = '345'
  } else if (op === 'drain') {
    // on the party day the long runs cover 9h50 to 21h30; a short run queued then would push one out
    if (partyDay && min >= 9 * 60 + 30 && min <= 21 * 60 + 45) return json(200, { skipped: 'party runs' })
    minutes = '0'
  } else minutes = ''

  if (!(await allowed(op))) return json(429, { skipped: 'too soon' })

  if (op === 'check') {
    const res = await fetch('https://api.github.com/repos/alanvitorb98-design/confra2026/actions/workflows/faces-worker.yml', {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'confra-rostos' },
    })
    return json(res.ok ? 200 : 502, { github: res.status })
  }

  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'confra-rostos', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { minutes } }),
  })
  if (!res.ok) return json(502, { github: res.status })
  return json(200, { started: minutes })
})
