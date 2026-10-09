import { REACTIONS, type Photo, type Reaction } from '../lib/types'

interface Props {
  photos: Photo[]
  onReact: (id: string, r: Reaction) => void
  onOpen: (photo: Photo) => void
}

const time = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export function Feed({ photos, onReact, onOpen }: Props) {
  return (
    <div className="feed">
      {photos.map((p) => (
        <article key={p.id} className="feed-item" style={{ '--tilt': `${p.tilt}deg` } as React.CSSProperties}>
          <figure className="polaroid polaroid-dark">
            <button className="polaroid-photo" onClick={() => onOpen(p)} aria-label={`Abrir foto de ${p.author}`}>
              {p.url ? <img src={p.url} alt={p.caption || `Foto de ${p.author}`} loading="lazy" /> : <span className="ph" style={{ background: p.placeholder }} />}
              <span className="stamp">'26 11 07 · {time(p.takenAt)}</span>
            </button>
            <figcaption>{p.caption || ' '}</figcaption>
          </figure>
          <div className="feed-meta">
            <span className="feed-author">@{p.author.toLowerCase().replace(/\s+/g, '.')}</span>
            <div className="reactions">
              {REACTIONS.map((r) => (
                <button key={r} className={`reaction${p.mine[r] ? ' on' : ''}`} onClick={() => onReact(p.id, r)} aria-pressed={!!p.mine[r]}>
                  <span>{r}</span>
                  {p.reactions[r] > 0 && <b>{p.reactions[r]}</b>}
                </button>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
