import { useState } from 'react'
import type { Guest } from '../lib/types'
import { SynthScene } from './SynthScene'

export function Welcome({ onEnter }: { onEnter: (g: Guest) => void }) {
  const [name, setName] = useState('')
  const [instagram, setInstagram] = useState('')
  const [faceOptIn, setFaceOptIn] = useState(true)
  const [selfieUrl, setSelfieUrl] = useState<string>()

  const pickSelfie = (f?: File) => {
    if (!f) return
    if (selfieUrl) URL.revokeObjectURL(selfieUrl)
    setSelfieUrl(URL.createObjectURL(f))
  }

  const ready = name.trim().length > 1 && (!faceOptIn || selfieUrl)

  return (
    <div className="welcome">
      <SynthScene variant="ambient" />
      <div className="logo-block">
        <h1 className="logo">CONFRA<span>26</span></h1>
        <p className="logo-sub">fim de ano · 07.11.2026</p>
      </div>

      <form
        className="welcome-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!ready) return
          onEnter({ name: name.trim(), instagram: instagram.replace(/^@/, '').trim() || undefined, faceOptIn, selfieUrl: faceOptIn ? selfieUrl : undefined })
        }}
      >
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

        <button className="btn neon wide" disabled={!ready}>Entrar na festa</button>
      </form>
    </div>
  )
}
