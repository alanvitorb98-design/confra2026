import { useEffect, useState } from 'react'
import { faceOptOut, myFaceProgress, myFaceStatus, sendSelfie, type FaceProgress } from '../lib/backend'
import type { Guest } from '../lib/types'
import { SelfieCam } from './SelfieCam'

type Status = 'none' | 'pending' | 'ready' | 'failed'

const TEXT: Record<Status, string> = {
  none: 'Desligado. Com uma selfie o app acha você nas fotos e conta no ranking de quem mais aparece.',
  pending: 'Analisando sua selfie… pode levar um minutinho.',
  ready: 'Ligado! O app já procura você nas fotos da festa.',
  failed: 'Não achei um rosto nessa selfie. Tenta outra, de frente e com luz.',
}

// The face server takes about a minute to start when it is off (about 53 s measured), then a few seconds per selfie.
const BOOT_S = 35

/** Percent and label for the bar: sending, starting the server (estimated by time), in line, reading, done. */
function progressOf(sending: boolean, p: FaceProgress | undefined, since: number, now: number) {
  const t = Math.max(0, (now - since) / 1000)
  if (sending) return { pct: Math.min(18, 4 + t * 6), label: 'Enviando a selfie…' }
  if (!p || p.status !== 'pending') return null
  if (p.reading) return { pct: 92, label: 'Lendo seu rosto…' }
  if (p.worker && p.ahead > 0) return { pct: 84, label: p.ahead === 1 ? '1 selfie na sua frente…' : `${p.ahead} selfies na sua frente…` }
  if (p.worker) return { pct: 86, label: 'Quase lá…' }
  return { pct: 20 + 60 * (1 - Math.exp(-t / BOOT_S)), label: 'Ligando o reconhecimento…' }
}

/** Face matching on the profile: turn it on with a selfie, or off (which wipes the signature and matches). */
export function FaceCard({ guest, onChange }: { guest: Guest; onChange: (g: Guest) => void }) {
  const [status, setStatus] = useState<Status>()
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [cam, setCam] = useState(false)
  const [prog, setProg] = useState<FaceProgress>()
  const [since, setSince] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    myFaceStatus(guest.id).then((s) => alive && setStatus(s))
    return () => {
      alive = false
    }
  }, [guest.id])

  // follow the analysis while it runs, and again as soon as the app comes back to the screen
  useEffect(() => {
    if (status !== 'pending') return
    let alive = true
    const check = () =>
      myFaceProgress().then((p) => {
        if (!alive || !p) return
        setProg(p)
        if (p.status !== 'pending') setStatus(p.status)
      })
    check()
    const poll = setInterval(check, 2500)
    const tick = setInterval(() => setNow(Date.now()), 400)
    const back = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', back)
    return () => {
      alive = false
      clearInterval(poll)
      clearInterval(tick)
      document.removeEventListener('visibilitychange', back)
    }
  }, [status])

  useEffect(() => {
    if (!busy) return
    const tick = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(tick)
  }, [busy])

  const pick = async (f?: File) => {
    if (!f) return
    setCam(false)
    setBusy(true)
    setSending(true)
    setSince(Date.now())
    setNow(Date.now())
    try {
      await sendSelfie(guest.id, f)
      onChange({ ...guest, faceOptIn: true, selfieUrl: URL.createObjectURL(f) })
      setProg(undefined)
      setSince(Date.now())
      setStatus('pending')
    } catch {
      setStatus('failed')
    } finally {
      setBusy(false)
      setSending(false)
    }
  }

  const bar = progressOf(sending, prog, since, now)
  if (!status) return null
  return (
    <div className="panel face-card">
      <b>Reconhecimento de rosto</b>
      {bar ? (
        <div className="face-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bar.pct)}>
          <div className="face-progress-top">
            <span>{bar.label}</span>
            <b>{Math.round(bar.pct)}%</b>
          </div>
          <div className="face-progress-track">
            <i style={{ width: `${bar.pct}%` }} />
          </div>
        </div>
      ) : (
        <p>{TEXT[status]}</p>
      )}
      <div className="admin-row">
        {status !== 'pending' && (
          <button className={`btn ${status === 'ready' ? 'ghost' : 'primary'} small`} disabled={busy} onClick={() => setCam(true)}>
            {busy ? 'Enviando…' : status === 'ready' ? 'Trocar selfie' : 'Tirar selfie'}
          </button>
        )}
        {(status === 'ready' || status === 'pending') && (
          <button
            className="btn ghost small"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await faceOptOut()
              onChange({ ...guest, faceOptIn: false, selfieUrl: undefined })
              setStatus('none')
              setBusy(false)
            }}
          >
            Desligar
          </button>
        )}
      </div>
      {cam && <SelfieCam onShot={pick} onClose={() => setCam(false)} />}
    </div>
  )
}
