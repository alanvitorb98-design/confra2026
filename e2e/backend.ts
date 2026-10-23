import type { Page } from '@playwright/test'

/** The organizer's settings as the database returns them; tests override what they need. */
export const event = {
  app_opens: '2026-11-06T20:00:00-03:00',
  party_starts: '2026-11-07T10:00:00-03:00',
  party_ends: '2026-11-07T20:00:00-03:00',
  look_opens: '2026-11-07T07:00:00-03:00',
  look_closes: '2026-11-07T12:00:00-03:00',
  test_mode: false,
  place: 'Centro de Eventos',
  address: null,
  maps_url: null,
}

export const GUEST_ID = '10000000-0000-4000-8000-0000000000aa'
const USER_ID = '00000000-0000-4000-8000-0000000000aa'
const USER = { id: USER_ID, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' }
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
// an unsigned login token valid until 2099: the fake backend never checks signatures
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.${Buffer.from('teste').toString('base64url')}`

/**
 * Answers every Supabase call in the browser, so tests never touch production. `rpc` maps a database
 * function to its answer; anything not listed gets an empty answer. Returns the calls made, for asserts.
 */
export async function fakeBackend(page: Page, rpc: Record<string, unknown> = {}) {
  const calls: { fn: string; body: unknown }[] = []
  const answers: Record<string, unknown> = { event_public: event, ...rpc }
  await page.route(/supabase\.co\//, async (route) => {
    const url = new URL(route.request().url())
    const fn = url.pathname.match(/\/rest\/v1\/rpc\/([\w_]+)/)?.[1]
    if (fn) {
      const body = route.request().postDataJSON?.() ?? null
      calls.push({ fn, body })
      const answer = fn in answers ? answers[fn] : null
      // a function as the answer decides per call; { status } answers with that HTTP error
      const out = typeof answer === 'function' ? (answer as (b: unknown) => unknown)(body) : answer
      if (out && typeof out === 'object' && 'status' in out) return route.fulfill({ status: (out as { status: number }).status, json: { message: 'falha simulada' } })
      return route.fulfill({ json: out })
    }
    // the join function signs the guest in: a token the app accepts without checking it
    if (url.pathname === '/functions/v1/join') {
      const body = route.request().postDataJSON?.() ?? null
      calls.push({ fn: 'join', body })
      // `join` in the answers decides per call: { status, json? } fails it, { json } adds to the answer
      const out = (typeof answers.join === 'function' ? (answers.join as (b: unknown) => unknown)(body) : null) as { status?: number; json?: object } | null
      if (out?.status) return route.fulfill({ status: out.status, json: out.json ?? { error: 'falha simulada' } })
      return route.fulfill({ json: { access_token: TOKEN, refresh_token: 'teste', guest_id: GUEST_ID, ...out?.json } })
    }
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: USER })
    if (url.pathname.startsWith('/storage/v1/object/')) {
      calls.push({ fn: 'upload', body: url.pathname })
      return route.fulfill({ json: { Key: url.pathname } })
    }
    if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ json: [] })
    if (url.pathname.startsWith('/realtime/')) return route.abort()
    return route.fulfill({ json: {} })
  })
  return calls
}
