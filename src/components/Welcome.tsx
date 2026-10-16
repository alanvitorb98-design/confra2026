import { SelfieIcon } from './Icons'
import { useState } from 'react'
import { JoinError } from '../lib/backend'
import type { Guest } from '../lib/types'
import { Logo } from './Logo'
import { PartyScene } from '../brand/PartyScene'
import { SelfieCam } from './SelfieCam'
import { BRAND } from '../brand/brand'

type NewGuest = Omit<Guest, 'id'>

export function Welcome({ code, onEnter, onBack }: { code: string; onEnter: (code: string, g: NewGuest) => Promise<void>; onBack: (code: string) => Promise<void> }) {
  const [back, setBack] = useState(false)
  const [name, setName] = useState('')
  const [instagram, setInstagram] = useState('')
  const [faceOptIn, setFaceOptIn] = useState(true)
  const [selfieUrl, setSelfieUrl] = useState<string>()
  const [cam, setCam] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const pickSelfie = (f?: File) => {
    if (!f) return
    if (selfieUrl) URL.revokeObjectURL(selfieUrl)
    setSelfieUrl(URL.createObjectURL(f))
    setCam(false)
  }

  const ready = name.trim().length > 1 && (!faceOptIn || selfieUrl)

  return (
    <div className="welcome">
      <PartyScene variant="ambient" />
      <div className="logo-block">
        <Logo />
        <p className="logo-sub">{BRAND.welcomeSub}</p>
      </div>

      {back ? (
        <ComeBack onBack={onBack} onCancel={() => setBack(false)} />
      ) : (
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
              reason === 'busy'
                  ? 'Muitas tentativas. Espera um pouco e tenta de novo.'
                  : 'Não deu pra entrar agora. Confere a internet e tenta de novo.',
            )
            setBusy(false)
          }
        }}
      >
        <label className="field">
          <span>Seu nome</span>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={BRAND.namePlaceholder} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>Instagram <em>opcional</em></span>
          <input id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@seu.perfil" autoCapitalize="none" />
        </label>

        <div className="consent">
          <b>Bora brincar de paparazzi?</b>
          <p>Pra valer as missões e o ranking de quem mais aparece, a gente reconhece seu rosto nas fotos. Seu rosto só é usado {BRAND.faceScope} e é apagado depois da festa.</p>
          <div className="consent-choice">
            <button type="button" className={`chip${faceOptIn ? ' on' : ''}`} onClick={() => setFaceOptIn(true)}>Topo!</button>
            <button type="button" className={`chip${!faceOptIn ? ' on' : ''}`} onClick={() => setFaceOptIn(false)}>Prefiro marcar na mão</button>
          </div>
          {faceOptIn && (
            <button type="button" className="selfie" onClick={() => setCam(true)}>
              {selfieUrl ? <img src={selfieUrl} alt="Sua selfie" /> : <span className="selfie-empty"><SelfieIcon /></span>}
              <span>{selfieUrl ? 'Trocar selfie' : 'Tirar minha selfie'}</span>
            </button>
          )}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn primary wide" disabled={!ready || busy}>{busy ? 'Entrando…' : 'Entrar na festa'}</button>
        <button type="button" className="install-skip back-link" onClick={() => setBack(true)}>Já me cadastrei em outro celular</button>
      </form>
      )}
      {cam && <SelfieCam onShot={pickSelfie} onClose={() => setCam(false)} />}
    </div>
  )
}

/** Back into the same account with the código de volta shown in "Eu". */
function ComeBack({ onBack, onCancel }: { onBack: (code: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return (
    <form
      className="welcome-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (clean.length !== 6 || busy) return
        setBusy(true)
        setError(undefined)
        try {
          await onBack(clean)
        } catch (err) {
          const reason = err instanceof JoinError ? err.reason : 'other'
          setError(
            reason === 'back'
              ? 'Esse código não confere. Ele fica na aba Eu do celular onde você se cadastrou.'
              : reason === 'busy'
                ? 'Muitas tentativas. Espera um pouco e tenta de novo.'
                : 'Não deu pra entrar agora. Confere a internet e tenta de novo.',
          )
          setBusy(false)
        }
      }}
    >
      <p className="back-help">Digita o código de volta que aparece na aba <b>Eu</b> do celular onde você se cadastrou. Assim você continua com as mesmas fotos e pontos, sem criar outra conta.</p>
      <label className="field">
        <span>Código de volta</span>
        <input className="back-code" value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} placeholder="XXXXXX" maxLength={8} autoCapitalize="characters" autoComplete="one-time-code" autoCorrect="off" spellCheck={false} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn primary wide" disabled={clean.length !== 6 || busy}>{busy ? 'Entrando…' : 'Voltar pra minha conta'}</button>
      <button type="button" className="install-skip back-link" onClick={onCancel}>Primeira vez aqui</button>
    </form>
  )
}
