import { useEffect, useState } from 'react'
import { faceOptOut, myFaceStatus, sendSelfie } from '../lib/backend'
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
  const [cam, setCam] = useState(false)

  useEffect(() => {
    let alive = true
    const check = () => myFaceStatus(guest.id).then((s) => alive && setStatus(s))
    check()
    // follow the analysis while it runs
    const id = setInterval(() => status === 'pending' && check(), 5000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [guest.id, status])

  const pick = async (f?: File) => {
    if (!f) return
    setCam(false)
    setBusy(true)
    try {
      await sendSelfie(guest.id, f)
      onChange({ ...guest, faceOptIn: true, selfieUrl: URL.createObjectURL(f) })
      setStatus('pending')
    } catch {
      setStatus('failed')
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null
  return (
    <div className="panel face-card">
      <b>Reconhecimento de rosto</b>
      <p>{TEXT[status]}</p>
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
