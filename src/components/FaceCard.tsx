import { useEffect, useState } from 'react'
import { faceOptOut, myFaceProgress, myFaceStatus, sendSelfie, type FaceProgress } from '../lib/backend'
import { progressOf } from '../lib/faceProgress'
import type { Guest } from '../lib/types'
import { SelfieCam } from './SelfieCam'

type Status = 'none' | 'pending' | 'ready' | 'failed'

const TEXT: Record<Status, string> = {
  none: 'Desligado. Com uma selfie o app acha você nas fotos e conta no ranking de quem mais aparece.',
  pending: 'Analisando sua selfie… pode levar um minutinho.',
  ready: 'Ligado! O app já procura você nas fotos da festa.',
  failed: 'Não achei um rosto nessa selfie. Tenta outra, de frente e com luz.',
}

/** Face matching on the profile: turn it on with a selfie, or off (which wipes the signature and matches). */
export function FaceCard({ guest, onChange }: { guest: Guest; onChange: (g: Guest) => void }) {
  const [status, setStatus] = useState<Status>()
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [cam, setCam] = useState(false)
  const [offFailed, setOffFailed] = useState(false)
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
              setOffFailed(false)
              const { error } = await faceOptOut(guest.id)
              setBusy(false)
              // off only when the server says so: offline it stays on, and says why
              if (error) return setOffFailed(true)
              onChange({ ...guest, faceOptIn: false, selfieUrl: undefined })
              setStatus('none')
            }}
          >
            Desligar
          </button>
        )}
      </div>
      {offFailed && <p className="form-error" role="alert">Não deu pra desligar (a internet caiu?). Tenta de novo.</p>}
      {cam && <SelfieCam onShot={pick} onClose={() => setCam(false)} />}
    </div>
  )
}
