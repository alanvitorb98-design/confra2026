import { useState } from 'react'
import { CheckIcon, LockIcon } from './Icons'
import { EVENT, clock, type Phase } from '../lib/event'
import type { Mission } from '../lib/types'

export interface People {
  /** the open mission with people, generated for this guest */
  current?: Mission
  done: Mission[]
  /** guests still missing before they unlock */
  need?: number
  /** turned off by the organizers */
  off: boolean
  swapsLeft: number
}

interface Props {
  missions: Mission[]
  people: People
  /** draws other people for the open mission with people */
  onSwap: (id: string) => Promise<unknown>
  /** opens the camera; the photo counts for that mission */
  onShoot: (missionId: string) => void
  /** missions only run while the party is on */
  locked: boolean
  phase: Phase
}

export function Missions({ missions, people, onSwap, onShoot, locked, phase }: Props) {
  if (locked)
    return (
      <div className="page">
        <h2 className="page-title">Missões</h2>
        <p className="page-lead">
          {phase === 'after' ? 'A festa acabou e as missões fecharam. Confere quem ganhou no Ranking!' : `As missões começam junto com a festa, às ${clock(EVENT.start)}. Fica de olho que elas chegam de surpresa.`}
        </p>
        <ul className="missions locked" aria-hidden>
          {missions.slice(0, 3).map((m) => (
            <li key={m.id} className="mission">
              <span className="mission-title">Missão secreta</span>
              <span className="mission-pts"><LockIcon /></span>
            </li>
          ))}
        </ul>
      </div>
    )

  // one at a time: the next mission shows up once the current one is done
  const done = missions.filter((m) => m.done)
  const open = missions.filter((m) => !m.done)
  const current = open[0]
  const left = open.length - 1
  return (
    <div className="page">
      <h2 className="page-title">Missões</h2>
      <p className="page-lead">A missão com gente é sorteada só pra você. As extras vêm uma por vez, numa ordem só sua. Cumpra tirando a foto pedida e a próxima aparece.</p>
      <PeopleMission people={people} onSwap={onSwap} onShoot={onShoot} />
      {missions.length === 0 && people.off && <p className="page-note">Nenhuma missão no ar agora. Fica de olho!</p>}
      {missions.length > 0 && (
        <p className="mission-progress">
          {done.length} de {missions.length} extras cumpridas
        </p>
      )}
      <ul className="missions">
        {current && (
          <li key={current.id} className="mission hot">
            <span className="mission-badge">Extra {done.length + 1}</span>
            <span className="mission-title">{current.title}</span>
            <span className="mission-pts">+{current.points}</span>
            {current.target && <span className="mission-hint">Vale quando o rosto de {current.target} aparecer na foto.</span>}
            {current.status === 'checking' && <span className="mission-hint" role="status">Conferindo quem está na foto…</span>}
            {current.status === 'missed' && <span className="mission-hint miss" role="status">Não encontrei {current.target ?? 'a pessoa'} na última foto. Tenta outra, com o rosto bem visível.</span>}
            <button className="btn primary small" onClick={() => onShoot(current.id)}>{current.status ? 'Tirar outra' : 'Tirar a foto'}</button>
          </li>
        )}
        {left > 0 && (
          <li className="mission next" aria-label={`Mais ${left} ${left === 1 ? 'missão extra' : 'missões extras'} depois desta`}>
            <span className="mission-title">{left === 1 ? 'Mais 1 extra' : `Mais ${left} extras`} depois desta</span>
            <span className="mission-pts"><LockIcon /></span>
          </li>
        )}
        {!current && missions.length > 0 && <li className="mission all-done"><span className="mission-title">Você cumpriu todas as extras! Se aparecer outra, ela chega aqui.</span></li>}
        {done.map((m) => (
          <li key={m.id} className="mission done">
            <span className="mission-title">{m.title}</span>
            <span className="mission-pts"><CheckIcon /> {m.points}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "e" between the last two names: Ana, Beto e Caio */
const listNames = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`)

/** The mission with people: a photo with guests drawn for you, one more person every two missions. */
function PeopleMission({ people, onSwap, onShoot }: { people: People; onSwap: Props['onSwap']; onShoot: Props['onShoot'] }) {
  const [swapping, setSwapping] = useState(false)
  const [swapError, setSwapError] = useState('')
  if (people.off) return null
  const c = people.current
  const swap = async () => {
    if (!c) return
    setSwapping(true)
    setSwapError('')
    try {
      await onSwap(c.id)
    } catch {
      setSwapError('Não deu pra trocar agora. Tenta de novo daqui a pouco.')
    } finally {
      setSwapping(false)
    }
  }
  return (
    <section className="people" aria-label="Missão com gente">
      {!c && people.need !== undefined && (
        <div className="mission people-wait">
          <span className="mission-badge">Missão com gente</span>
          <span className="mission-title">
            Libera quando mais {people.need} {people.need === 1 ? 'convidado entrar' : 'convidados entrarem'} no app.
          </span>
          <span className="mission-hint">Aí o app sorteia gente da festa pra sair na foto com você. Chama quem estiver perto pra entrar!</span>
        </div>
      )}
      {c && (
        <div key={c.id} className="mission hot people-card">
          <span className="mission-badge">Missão com gente{people.done.length ? ` · ${people.done.length + 1}ª` : ''}</span>
          <span className="mission-title">{c.title}</span>
          <span className="mission-pts">+{c.points}</span>
          <span className="mission-hint">
            {c.people && c.people.length > 1 ? `Vale quando os rostos de ${listNames(c.people)} aparecerem juntos na foto.` : `Vale quando o rosto de ${c.people?.[0] ?? 'quem foi sorteado'} aparecer na foto.`}
          </span>
          {c.status === 'checking' && <span className="mission-hint" role="status">Conferindo quem está na foto…</span>}
          {c.status === 'missed' && <span className="mission-hint miss" role="status">Faltou alguém na última foto. Junta todo mundo, com o rosto bem visível.</span>}
          <div className="people-actions">
            <button className="btn primary small" onClick={() => onShoot(c.id)}>{c.status ? 'Tirar outra' : 'Tirar a foto'}</button>
            {people.swapsLeft > 0 && (
              <button className="btn ghost small" onClick={swap} disabled={swapping}>
                {swapping ? 'Sorteando…' : `Não achei, trocar (${people.swapsLeft})`}
              </button>
            )}
          </div>
          {swapError && <span className="mission-hint miss" role="alert">{swapError}</span>}
        </div>
      )}
      {people.done.length > 0 && (
        <ul className="missions people-done">
          {people.done.map((m) => (
            <li key={m.id} className="mission done">
              <span className="mission-title">{m.title}</span>
              <span className="mission-pts"><CheckIcon /> {m.points}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
