import { EVENT, clock, type Phase } from '../lib/event'
import type { Mission } from '../lib/types'

interface Props {
  missions: Mission[]
  onShoot: () => void
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

  const open = missions.filter((m) => !m.done)
  const done = missions.filter((m) => m.done)
  return (
    <div className="page">
      <h2 className="page-title">Missões</h2>
      <p className="page-lead">Novas missões chegam durante a festa. Cumpra tirando a foto pedida.</p>
      <ul className="missions">
        {open.map((m, i) => (
          <li key={m.id} className={`mission${i === 0 ? ' hot' : ''}`}>
            {i === 0 && <span className="mission-badge">Surpresa</span>}
            <span className="mission-title">{m.title}</span>
            <span className="mission-pts">+{m.points}</span>
            {i === 0 && <button className="btn primary small" onClick={onShoot}>Tirar a foto</button>}
          </li>
        ))}
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
