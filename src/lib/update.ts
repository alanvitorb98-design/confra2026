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

/**
 * Fetches the newest app and restarts into it. The service worker caches the app for offline use, so a
 * plain reload can show the old one: this makes it check for the new files, then reloads once it took over.
 */
export async function updateNow() {
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
