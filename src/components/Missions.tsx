import { EVENT, clock, type Phase } from '../lib/event'
import type { Mission } from '../lib/types'

interface Props {
  missions: Mission[]
  /** opens the camera; the photo counts for that mission */
  onShoot: (missionId: string) => void
  /** missions only run while the party is on */
  locked: boolean
  phase: Phase
}

export function Missions({ missions, onShoot, locked, phase }: Props) {
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
              <span className="mission-pts">🔒</span>
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
      <p className="page-lead">Uma missão por vez, numa ordem só sua. Cumpra tirando a foto pedida e a próxima aparece.</p>
      {missions.length === 0 && <p className="page-note">Nenhuma missão no ar agora. Fica de olho!</p>}
      {missions.length > 0 && (
        <p className="mission-progress">
          {done.length} de {missions.length} cumpridas
        </p>
      )}
      <ul className="missions">
        {current && (
          <li key={current.id} className="mission hot">
            <span className="mission-badge">Missão {done.length + 1}</span>
            <span className="mission-title">{current.title}</span>
            <span className="mission-pts">+{current.points}</span>
            {current.target && <span className="mission-hint">Vale quando o rosto de {current.target} aparecer na foto.</span>}
            {current.status === 'checking' && <span className="mission-hint" role="status">Conferindo quem está na foto…</span>}
            {current.status === 'missed' && <span className="mission-hint miss" role="status">Não encontrei {current.target ?? 'a pessoa'} na última foto. Tenta outra, com o rosto bem visível.</span>}
            <button className="btn primary small" onClick={() => onShoot(current.id)}>{current.status ? 'Tirar outra' : 'Tirar a foto'}</button>
          </li>
        )}
        {left > 0 && (
          <li className="mission next" aria-label={`Mais ${left} ${left === 1 ? 'missão' : 'missões'} depois desta`}>
            <span className="mission-title">{left === 1 ? 'Mais 1 missão' : `Mais ${left} missões`} depois desta</span>
            <span className="mission-pts">🔒</span>
          </li>
        )}
        {!current && missions.length > 0 && <li className="mission all-done"><span className="mission-title">Você cumpriu todas! Se aparecer missão nova, ela chega aqui.</span></li>}
        {done.map((m) => (
          <li key={m.id} className="mission done">
            <span className="mission-title">{m.title}</span>
            <span className="mission-pts">✓ {m.points}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
