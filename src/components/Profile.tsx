import type { Guest } from '../lib/types'
import CountUp from './bits/CountUp'

interface Props {
  guest: Guest
  myPhotos: number
  points: number
  onLeave: () => void
}

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = window.matchMedia('(display-mode: standalone)').matches

export function Profile({ guest, myPhotos, points, onLeave }: Props) {
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
      <dl className="stats">
        <div><dt>Fotos</dt><dd><CountUp to={myPhotos} /></dd></div>
        <div><dt>Pontos</dt><dd><CountUp to={points} /></dd></div>
        <div><dt>Rosto</dt><dd>{guest.faceOptIn ? 'Ligado' : 'Manual'}</dd></div>
      </dl>
      {!standalone && (
        <div className="install">
          <b>Instale na tela inicial</b>
          <p>{isIOS ? 'No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".' : 'No menu do Chrome, toque em "Instalar app" ou "Adicionar à tela inicial".'}</p>
        </div>
      )}
      <button className="btn ghost wide" onClick={onLeave}>Sair</button>
    </div>
  )
}
