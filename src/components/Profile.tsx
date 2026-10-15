import { useEffect, useState } from 'react'
import { myReturnCode } from '../lib/backend'
import type { Guest } from '../lib/types'
import { FaceCard } from './FaceCard'
import { VersionCard } from './VersionCard'
import CountUp from './bits/CountUp'

interface Props {
  guest: Guest
  myPhotos: number
  points: number
  onLeave: () => void
  onGuest: (g: Guest) => void
  isAdmin: boolean
  onPanel: () => void
  /** organizer code: true when accepted */
  onClaim: (code: string) => Promise<boolean>
}

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = window.matchMedia('(display-mode: standalone)').matches

function Organizer({ isAdmin, onPanel, onClaim }: Pick<Props, 'isAdmin' | 'onPanel' | 'onClaim'>) {
  const [asking, setAsking] = useState(false)
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'wrong'>('idle')
  if (isAdmin) return <button className="btn primary wide" onClick={onPanel}>Painel do organizador</button>
  if (!asking) return <button className="install-skip organizer-link" onClick={() => setAsking(true)}>Sou da organização</button>
  return (
    <form
      className="organizer"
      onSubmit={async (e) => {
        e.preventDefault()
        setState('busy')
        setState((await onClaim(code)) ? 'idle' : 'wrong')
      }}
    >
      <label className="field">
        <span>Código de organizador</span>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ADM-XXXXXXXX" autoCapitalize="characters" autoComplete="off" />
      </label>
      {state === 'wrong' && <p className="form-error">Código não confere.</p>}
      <button className="btn ghost wide" disabled={state === 'busy' || code.length < 6}>{state === 'busy' ? 'Conferindo…' : 'Liberar painel'}</button>
    </form>
  )
}

/** The código de volta: gets this account back on another phone or browser. */
function useReturnCode() {
  const [code, setCode] = useState<string>()
  useEffect(() => {
    myReturnCode().then(setCode).catch(() => undefined)
  }, [])
  return code
}

export function Profile({ guest, myPhotos, points, onLeave, onGuest, isAdmin, onPanel, onClaim }: Props) {
  const code = useReturnCode()
  return (
    <div className="page">
      <div className="profile">
        {guest.selfieUrl ? <img className="avatar" src={guest.selfieUrl} alt="" /> : <span className="avatar empty">{guest.name[0]}</span>}
        <div>
          <h2 className="page-title">{guest.name}</h2>
          {guest.instagram && (
            <a className="insta" href={`https://instagram.com/${guest.instagram}`} target="_blank" rel="noreferrer">@{guest.instagram}</a>
          )}
        </div>
      </div>
      <dl className="stats two">
        <div><dt>Fotos</dt><dd><CountUp to={myPhotos} /></dd></div>
        <div><dt>Pontos</dt><dd><CountUp to={points} /></dd></div>
      </dl>
      <FaceCard guest={guest} onChange={onGuest} />
      {code && (
        <div className="return-code">
          <div>
            <b>Seu código de volta</b>
            <p>Trocou de celular ou o navegador te deslogou? Toca em "Já me cadastrei" na entrada e digita esse código.</p>
          </div>
          <code>{code}</code>
        </div>
      )}
      {!standalone && (
        <div className="install">
          <b>Instale na tela inicial</b>
          <p>{isIOS ? 'No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".' : 'No menu do Chrome, toque em "Instalar app" ou "Adicionar à tela inicial".'}</p>
        </div>
      )}
      <Organizer isAdmin={isAdmin} onPanel={onPanel} onClaim={onClaim} />
      <button
        className="btn ghost wide"
        onClick={() => confirm(code ? `Sair deste celular? Pra voltar depois, use o código ${code}.` : 'Sair deste celular?') && onLeave()}
      >
        Sair
      </button>
      <VersionCard />
    </div>
  )
}
