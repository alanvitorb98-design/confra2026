/** The version this phone is running (set at build time). */
export const APP_VERSION = __APP_VERSION__

/** Asks the server for the newest version; null when offline. */
export async function latestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    return res.ok ? ((await res.json()) as { version: string }).version : null
  } catch {
    return null
  }
}

const TRIED_KEY = 'update.tried'

/**
 * Fetches the newest app and restarts into it. The service worker caches the app for offline use, so a
 * plain reload can show the old one: this makes it check for the new files, then reloads once it took over.
 */
export async function updateNow() {
  // a second try in a row means the cached app is stuck: drop the service worker and its files, then reload
  try {
    if (sessionStorage.getItem(TRIED_KEY)) {
      sessionStorage.removeItem(TRIED_KEY)
      const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
      await Promise.all(regs.map((r) => r.unregister()))
      if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
      location.reload()
      return
    }
    sessionStorage.setItem(TRIED_KEY, '1')
  } catch {
    /* storage blocked: plain update below */
  }
  const reg = await navigator.serviceWorker?.getRegistration()
  if (reg) {
    await reg.update().catch(() => undefined)
    const waiting = reg.waiting ?? reg.installing
    if (waiting) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
        waiting.postMessage({ type: 'SKIP_WAITING' })
        setTimeout(resolve, 4000)
      })
    }
  }
  location.reload()
}

// a photo being developed is never lost to an update: the screen waits until it is posted or discarded
let held = false
const holdListeners = new Set<(held: boolean) => void>()
export function holdUpdate(on: boolean) {
  held = on
  holdListeners.forEach((fn) => fn(on))
}
export function onHold(fn: (held: boolean) => void) {
  holdListeners.add(fn)
  fn(held)
  return () => void holdListeners.delete(fn)
}
