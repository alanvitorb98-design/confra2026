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
      calls.push({ fn, body: route.request().postDataJSON?.() ?? null })
      return route.fulfill({ json: fn in answers ? answers[fn] : null })
    }
    if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ json: [] })
    if (url.pathname.startsWith('/realtime/')) return route.abort()
    return route.fulfill({ json: {} })
  })
  return calls
}
