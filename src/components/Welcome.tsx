import { useState } from 'react'
import { JoinError } from '../lib/backend'
import type { Guest } from '../lib/types'
import { Logo } from './Logo'
import { PartyScene } from './PartyScene'

type NewGuest = Omit<Guest, 'id'>

export function Welcome({ code: fromQr, onEnter }: { code: string; onEnter: (code: string, g: NewGuest) => Promise<void> }) {
  const [code, setCode] = useState(fromQr)
  const [name, setName] = useState('')
  const [instagram, setInstagram] = useState('')
  const [faceOptIn, setFaceOptIn] = useState(true)
  const [selfieUrl, setSelfieUrl] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const pickSelfie = (f?: File) => {
    if (!f) return
    if (selfieUrl) URL.revokeObjectURL(selfieUrl)
    setSelfieUrl(URL.createObjectURL(f))
  }

  const ready = code.trim().length >= 4 && name.trim().length > 1 && (!faceOptIn || selfieUrl)

  return (
    <div className="welcome">
      <PartyScene variant="ambient" />
      <div className="logo-block">
        <Logo />
        <p className="logo-sub">Equipe Derhu · 07/11</p>
      </div>

      <form
        className="welcome-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!ready || busy) return
          setBusy(true)
          setError(undefined)
          try {
            await onEnter(code.trim(), { name: name.trim(), instagram: instagram.replace(/^@/, '').trim() || undefined, faceOptIn, selfieUrl: faceOptIn ? selfieUrl : undefined })
          } catch (err) {
            const reason = err instanceof JoinError ? err.reason : 'other'
            setError(
              reason === 'code'
                ? 'Código do convite não confere. Confere o que veio no QR.'
                : reason === 'busy'
                  ? 'Muitas tentativas. Espera um pouco e tenta de novo.'
                  : 'Não deu pra entrar agora. Confere a internet e tenta de novo.',
            )
            setBusy(false)
          }
        }}
      >
        {!fromQr && (
          <label className="field">
            <span>Código do convite</span>
            <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CONFRA-XXXXX" autoCapitalize="characters" autoComplete="off" />
          </label>
        )}
        <label className="field">
          <span>Seu nome</span>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="como te chamam na firma" autoComplete="given-name" />
        </label>
        <label className="field">
          <span>Instagram <em>opcional</em></span>
          <input id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@seu.perfil" autoCapitalize="none" />
        </label>

        <div className="consent">
          <b>Bora brincar de paparazzi?</b>
          <p>Pra valer as missões e o ranking de quem mais aparece, a gente reconhece seu rosto nas fotos. Seu rosto só é usado aqui na confra e é apagado depois da festa.</p>
          <div className="consent-choice">
            <button type="button" className={`chip${faceOptIn ? ' on' : ''}`} onClick={() => setFaceOptIn(true)}>Topo!</button>
            <button type="button" className={`chip${!faceOptIn ? ' on' : ''}`} onClick={() => setFaceOptIn(false)}>Prefiro marcar na mão</button>
          </div>
          {faceOptIn && (
            <label className="selfie">
              <input id="selfie" type="file" accept="image/*" capture="user" onChange={(e) => pickSelfie(e.target.files?.[0])} hidden />
              {selfieUrl ? <img src={selfieUrl} alt="Sua selfie" /> : <span className="selfie-empty">+</span>}
              <span>{selfieUrl ? 'Trocar selfie' : 'Tirar minha selfie'}</span>
            </label>
          )}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={!ready || busy}>{busy ? 'Entrando…' : 'Entrar na festa'}</button>
      </form>
    </div>
  )
}
