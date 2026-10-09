import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { buzz } from '../lib/motion'
import { REACTIONS, type Photo, type Reaction } from '../lib/types'
import ClickSpark from './bits/ClickSpark'
import { PolaroidFrame } from './Polaroid'

interface Props {
  photos: Photo[]
  onReact: (id: string, r: Reaction, force?: boolean) => void
  onOpen: (photo: Photo) => void
  /** what to say while the wall is empty */
  empty: string
  /** shown left of the stack/grid switch, e.g. the party/outfit wall switch */
  header?: ReactNode
  /** send again a photo whose upload failed */
  onRetry?: (id: string) => void
}

const time = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const handle = (name: string) => '@' + name.toLowerCase().replace(/\s+/g, '.')

const FLING_DISTANCE = 100
const FLING_VELOCITY = 500
const DOUBLE_TAP_MS = 280
const VISIBLE = 3
const spring = { type: 'spring', stiffness: 320, damping: 26 } as const

interface CardProps {
  photo: Photo
  depth: number
  burst: number
  onFling: () => void
  onTap: () => void
}

function Card({ photo, depth, burst, onFling, onTap }: CardProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, (v) => v / 14)
  const isTop = depth === 0
  const dragged = useRef(false)

  const end = async (_: unknown, info: PanInfo) => {
    // keep the release of a drag from counting as a tap
    setTimeout(() => (dragged.current = false), 50)
    const far = Math.abs(info.offset.x) > FLING_DISTANCE || Math.abs(info.velocity.x) > FLING_VELOCITY
    if (!far) return
    const dir = Math.sign(info.offset.x || info.velocity.x) || 1
    buzz(8)
    await animate(x, dir * window.innerWidth, { duration: 0.22, ease: 'easeIn' })
    onFling()
    // slide back in behind the others
    animate(x, 0, { type: 'spring', stiffness: 200, damping: 24 })
  }

  return (
    <motion.div
      className="stack-card"
      style={{ zIndex: VISIBLE - depth }}
      initial={false}
      animate={{
        y: depth * 14,
        scale: 1 - depth * 0.05,
        rotate: depth === 0 ? photo.tilt : photo.tilt * (depth % 2 ? -1.8 : 1.8),
      }}
      transition={spring}
    >
      {/* dim the cards behind with an overlay: animating filter repaints the whole card every frame */}
      <motion.span className="stack-shade" aria-hidden initial={false} animate={{ opacity: depth * 0.2 }} transition={spring} />
      <motion.div
        className={isTop ? 'stack-drag' : undefined}
        style={{ x, rotate }}
        drag={isTop ? 'x' : false}
        dragSnapToOrigin
        dragElastic={0.9}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={end}
        onTap={isTop ? () => !dragged.current && onTap() : undefined}
        whileTap={isTop ? { scale: 0.98 } : undefined}
      >
        <PolaroidFrame frame={photo.frame}>
          <div className="polaroid-photo">
            {photo.url ? <img src={photo.preview ?? photo.url} alt={photo.caption || `Foto de ${photo.author}`} draggable={false} crossOrigin="anonymous" /> : <span className="ph" style={{ background: photo.placeholder }} />}
            <span className="stamp">'26 11 07 · {time(photo.takenAt)}</span>
            {isTop && burst > 0 && (
              <motion.span
                key={burst}
                className="burst-emoji"
                aria-hidden
                initial={{ scale: 0.2, opacity: 0, rotate: -20 }}
                animate={{ scale: [0.2, 1.2, 1, 1.25], opacity: [0, 1, 1, 0], rotate: [-20, 8, 0, 0], y: [0, 0, 0, -60] }}
                transition={{ duration: 0.9, times: [0, 0.3, 0.7, 1] }}
              >
                🔥
              </motion.span>
            )}
          </div>
          <figcaption>{photo.caption || ' '}</figcaption>
        </PolaroidFrame>
      </motion.div>
    </motion.div>
  )
}

/** Stack of Polaroids: fling the top one aside to see the next, double tap to react with 🔥. */
export function Feed({ photos, onReact, onOpen, empty, header, onRetry }: Props) {
  // follow the card on top by id, so photos arriving live from others don't move it
  const [topId, setTopId] = useState<string>()
  const [burst, setBurst] = useState(0)
  const [view, setView] = useState<'stack' | 'grid'>('stack')
  const lastTap = useRef(0)
  const tapTimer = useRef<number>()
  const count = photos.length

  // my own new post lands on top of the stack
  const newest = photos[0]
  const mineNew = newest?.status === 'sending' ? newest.id : undefined
  useEffect(() => {
    if (mineNew) setTopId(mineNew)
  }, [mineNew])
  const index = Math.max(0, photos.findIndex((p) => p.id === topId))
  useEffect(() => () => clearTimeout(tapTimer.current), [])

  if (count === 0)
    return (
      <div className="feed">
        {header && <div className="feed-bar">{header}</div>}
        <p className="feed-empty">{empty}</p>
      </div>
    )

  const top = photos[index % count]
  const shown = Math.min(VISIBLE, count)

  const tap = () => {
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      clearTimeout(tapTimer.current)
      lastTap.current = 0
      onReact(top.id, '🔥', true)
      setBurst((b) => b + 1)
      buzz([10, 30, 20])
    } else {
      lastTap.current = now
      tapTimer.current = window.setTimeout(() => onOpen(top), DOUBLE_TAP_MS)
    }
  }

  const toggle = (
    <div className={`feed-bar${header ? ' split' : ''}`}>
      {header}
      <div className={`segmented feed-toggle${header ? ' compact' : ''}`} role="tablist" aria-label="Visualização">
        <button role="tab" aria-selected={view === 'stack'} onClick={() => setView('stack')}>Pilha</button>
        <button role="tab" aria-selected={view === 'grid'} onClick={() => setView('grid')}>Grade</button>
      </div>
    </div>
  )

  if (view === 'grid')
    return (
      <div className="feed">
        {toggle}
        <div className="grid">
          {photos.map((p, i) => (
            <motion.button
              key={p.id}
              className="grid-item"
              onClick={() => onOpen(p)}
              initial={{ opacity: 0, y: 16, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: p.tilt }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 260, damping: 22 }}
              whileTap={{ scale: 0.95 }}
            >
              <PolaroidFrame frame={p.frame}>
                <span className="polaroid-photo">
                  {p.url ? <img src={p.preview ?? p.url} alt={p.caption || `Foto de ${p.author}`} loading="lazy" crossOrigin="anonymous" /> : <span className="ph" style={{ background: p.placeholder }} />}
                  <span className="stamp">{time(p.takenAt)}</span>
                </span>
                <figcaption>{p.caption || '\u00a0'}</figcaption>
              </PolaroidFrame>
            </motion.button>
          ))}
        </div>
      </div>
    )

  return (
    <div className="feed">
      {toggle}
      <div className="stack">
        {photos.map((p, i) => {
          const depth = (i - (index % count) + count) % count
          if (depth >= shown) return null
          return <Card key={p.id} photo={p} depth={depth} burst={depth === 0 ? burst : 0} onTap={tap} onFling={() => setTopId(photos[(index + 1) % count].id)} />
        })}
      </div>

      <div className="feed-meta">
        {top.status === 'failed' ? (
          <button className="feed-status failed" onClick={() => onRetry?.(top.id)}>Não foi. Tocar pra reenviar</button>
        ) : top.status === 'sending' ? (
          <span className="feed-status">Enviando…</span>
        ) : (
          <span className="feed-author">{handle(top.author)}</span>
        )}
        <span className="feed-pos">
          {(index % count) + 1} / {count}
        </span>
      </div>
      <ClickSpark className="reactions">
        {REACTIONS.map((r) => (
          <motion.button
            key={r}
            className={`reaction${top.mine[r] ? ' on' : ''}`}
            onClick={() => onReact(top.id, r)}
            aria-pressed={!!top.mine[r]}
            whileTap={{ scale: 0.85 }}
          >
            <motion.span key={`${top.id}${r}${top.mine[r]}`} initial={top.mine[r] ? { scale: 1.6, rotate: -14 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
              {r}
            </motion.span>
            {top.reactions[r] > 0 && <b>{top.reactions[r]}</b>}
          </motion.button>
        ))}
      </ClickSpark>
      <p className="feed-tip">Arrasta pro lado pra ver a próxima · toque duplo solta um 🔥</p>
    </div>
  )
}
