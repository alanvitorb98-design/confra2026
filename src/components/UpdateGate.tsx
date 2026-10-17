import { useEffect, useState } from 'react'
import { APP_VERSION, latestVersion, onHold, updateNow } from '../lib/update'

const CHECK_MS = 5 * 60_000

/**
 * Holds the app while this phone runs an older version than the one online, so nobody uses (or tests) a
 * stale screen. Offline it lets the app through: no answer is not a reason to lock anyone out.
 */
export function UpdateGate() {
  const [latest, setLatest] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [held, setHeld] = useState(false)
  useEffect(() => onHold(setHeld), [])

  useEffect(() => {
    const check = () => latestVersion().then((v) => v && setLatest(v))
    check()
    const timer = setInterval(() => document.visibilityState === 'visible' && check(), CHECK_MS)
    const wake = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [])

  if (!latest || latest === APP_VERSION || held) return null
  return (
    <div className="update-gate" role="alertdialog" aria-modal="true" aria-label="Atualizar o app">
      <div className="update-card">
        <b>Tem versão nova do app</b>
        <p>Atualiza pra continuar. Leva só uns segundos, e suas fotos e seu cadastro continuam aqui.</p>
        <button
          className="btn primary wide"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void updateNow()
          }}
        >
          {busy ? 'Atualizando…' : 'Atualizar agora'}
        </button>
      </div>
    </div>
  )
}
