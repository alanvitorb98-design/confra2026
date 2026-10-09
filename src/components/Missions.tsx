import type { Mission } from '../lib/types'

export function Missions({ missions, onShoot }: { missions: Mission[]; onShoot: () => void }) {
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
            {i === 0 && <button className="btn neon small" onClick={onShoot}>Tirar a foto</button>}
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
