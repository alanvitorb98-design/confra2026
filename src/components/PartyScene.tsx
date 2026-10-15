import type { CSSProperties } from 'react'

// Cream paper, fine gold line-work: fireworks that open and droop like real ones, serpentine streamers,
// foil confetti and two champagne flutes. Drawn for this app; everything is SVG + CSS so it stays crisp
// and cheap to paint on phones.

interface Props {
  /** intro: fireworks open one after another, flutes slide in; ambient: calm backdrop behind the app */
  variant: 'intro' | 'ambient'
}

type Pos = CSSProperties & { '--d'?: string; '--s'?: string; '--r'?: string }

// x/y in % of the screen, size in vmin
const FIREWORKS: { x: number; y: number; s: number; rays: number; seed: number }[] = [
  { x: 50, y: 1, s: 62, rays: 30, seed: 1 },
  { x: 97, y: 24, s: 40, rays: 22, seed: 2 },
  { x: 1, y: 20, s: 36, rays: 20, seed: 3 },
  { x: 8, y: 88, s: 40, rays: 24, seed: 4 },
  { x: 92, y: 86, s: 48, rays: 26, seed: 5 },
]

const STREAMERS: { x: number; y: number; s: number; r: number }[] = [
  { x: 24, y: 12, s: 16, r: -24 },
  { x: 80, y: 8, s: 14, r: 30 },
  { x: 90, y: 52, s: 13, r: 76 },
  { x: 6, y: 56, s: 12, r: 110 },
  { x: 30, y: 92, s: 15, r: -8 },
  { x: 68, y: 95, s: 12, r: 14 },
]

const CONFETTI: { x: number; y: number; s: number; r: number; ink?: boolean }[] = [
  { x: 14, y: 9, s: 2.2, r: 20 }, { x: 36, y: 5, s: 1.6, r: 50, ink: true }, { x: 66, y: 16, s: 2, r: 10 },
  { x: 74, y: 34, s: 1.4, r: 35, ink: true }, { x: 18, y: 40, s: 1.8, r: 60 }, { x: 95, y: 42, s: 2.4, r: 15 },
  { x: 4, y: 72, s: 2, r: 40, ink: true }, { x: 84, y: 70, s: 1.6, r: 70 }, { x: 44, y: 86, s: 2.2, r: 25 },
  { x: 58, y: 76, s: 1.4, r: 5, ink: true }, { x: 26, y: 70, s: 1.6, r: 55 }, { x: 52, y: 26, s: 1.3, r: 30 },
]

const SPARKLES: { x: number; y: number; s: number }[] = [
  { x: 34, y: 18, s: 3.4 }, { x: 70, y: 24, s: 2.6 }, { x: 12, y: 32, s: 2.4 }, { x: 88, y: 36, s: 3 },
  { x: 20, y: 80, s: 2.6 }, { x: 76, y: 90, s: 2.2 }, { x: 60, y: 60, s: 1.8 },
]

const SPARKLE = 'M0-12C1.2-3 3-1.2 12 0 3 1.2 1.2 3 0 12-1.2 3-3 1.2-12 0-3-1.2-1.2-3 0-12Z'

/** Small deterministic jitter so each firework looks hand-drawn rather than computed. */
function jitter(seed: number, i: number) {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * A peony with a willow droop: rays bend down at the tips under "gravity" and end in falling sparks.
 * Long rays are gold, short ones a deeper bronze, so the burst has depth.
 */
function Firework({ rays, seed }: { rays: number; seed: number }) {
  const g = 14 // droop at the tip of a full-length ray
  const items = Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2 + jitter(seed, i) * 0.12
    const long = i % 2 === 0
    const len = (long ? 80 : 56) * (0.88 + jitter(seed, i + 50) * 0.18)
    const r0 = long ? 12 : 18
    const k = len / 80
    const sx = Math.cos(a) * r0
    const sy = Math.sin(a) * r0
    const ex = Math.cos(a) * len
    const ey = Math.sin(a) * len + g * k * k
    const cx = Math.cos(a) * (len * 0.62)
    const cy = Math.sin(a) * (len * 0.62)
    // sparks keep falling past the tip
    const dx = ex - cx
    const dy = ey - cy
    const dl = Math.hypot(dx, dy) || 1
    const sparks = long
      ? [7, 13, 18].map((t, j) => ({ x: ex + (dx / dl) * t, y: ey + (dy / dl) * t + j * j * 1.6, r: [1.9, 1.3, 0.8][j] }))
      : []
    return { d: `M${sx.toFixed(1)} ${sy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`, long, sparks }
  })
  return (
    <svg viewBox="-110 -110 220 220" className="fw-svg">
      <circle r="5" className="fw-heart" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return <circle key={`c${i}`} cx={Math.cos(a) * 26} cy={Math.sin(a) * 26} r="1.3" className="fw-ring" />
      })}
      {items.map((it, i) => (
        <g key={i} className={it.long ? 'fw-long' : 'fw-short'} style={{ '--i': i } as CSSProperties}>
          <path d={it.d} pathLength={1} className="fw-ray" />
          {it.sparks.map((s, j) => (
            <circle key={j} cx={s.x} cy={s.y} r={s.r} className="fw-spark" style={{ '--j': j } as CSSProperties} />
          ))}
        </g>
      ))}
    </svg>
  )
}

/** A serpentine streamer: a ribbon that curls, with its lit edge and its shadowed edge. */
function Streamer() {
  const d = 'M2 24C14 4 24 6 30 17S46 32 56 14 66 6 70 10'
  return (
    <svg viewBox="0 0 72 34" className="streamer-svg">
      <path d={d} className="streamer-back" />
      <path d={d} className="streamer-front" />
    </svg>
  )
}

/** Champagne flute with rising bubbles; `side` mirrors it. */
function Flute({ side }: { side: 'l' | 'r' }) {
  const bowl = 'M34 8C30 44 30 76 40 96C44 104 52 108 60 108C68 108 76 104 80 96C90 76 90 44 86 8Z'
  return (
    <svg viewBox="0 0 120 250" className={`flute flute-${side}`}>
      <defs>
        <clipPath id={`flute-${side}`}><path d={bowl} /></clipPath>
        <linearGradient id={`bubbly-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8e3a0" />
          <stop offset="1" stopColor="#e2b44a" />
        </linearGradient>
      </defs>
      <path d={bowl} className="flute-glass" />
      <g clipPath={`url(#flute-${side})`}>
        <path d="M20 34Q60 28 100 34V120H20Z" fill={`url(#bubbly-${side})`} />
        <path d="M20 34Q60 28 100 34" className="flute-foam" />
        {[
          { x: 50, d: 0 }, { x: 62, d: 0.9 }, { x: 70, d: 1.7 }, { x: 56, d: 2.4 }, { x: 66, d: 3.1 },
        ].map((b, i) => (
          <circle key={i} cx={b.x} cy="100" r={1.4 + (i % 3) * 0.5} className="flute-bubble" style={{ '--d': `${b.d}s` } as CSSProperties} />
        ))}
      </g>
      {/* glints on the glass */}
      <path d="M40 18C38 44 38 66 44 86" className="flute-glint" />
      <path d={bowl} className="flute-line" />
      <path d="M60 108V214" className="flute-line" />
      <path d="M60 196C58 204 52 210 34 216C48 222 72 222 86 216C68 210 62 204 60 196" className="flute-line flute-foot" />
    </svg>
  )
}

export function PartyScene({ variant }: Props) {
  return (
    <div className={`party party-${variant}`} aria-hidden>
      {FIREWORKS.map((f, i) => (
        <div key={`f${i}`} className="fw" style={{ left: `${f.x}%`, top: `${f.y}%`, '--s': `${f.s}vmin`, '--d': `${0.2 + i * 0.38}s` } as Pos}>
          <Firework rays={f.rays} seed={f.seed} />
        </div>
      ))}
      {STREAMERS.map((s, i) => (
        <div key={`st${i}`} className="streamer" style={{ left: `${s.x}%`, top: `${s.y}%`, '--s': `${s.s}vmin`, '--r': `${s.r}deg`, '--d': `${(i % 3) * 1.3}s` } as Pos}>
          <Streamer />
        </div>
      ))}
      {CONFETTI.map((c, i) => (
        <span
          key={`c${i}`}
          className={`foil${c.ink ? ' ink' : ''}`}
          style={{ left: `${c.x}%`, top: `${c.y}%`, '--s': `${c.s}vmin`, '--r': `${c.r}deg`, '--d': `${(i % 5) * 0.6}s` } as Pos}
        />
      ))}
      {SPARKLES.map((s, i) => (
        <svg key={`sp${i}`} viewBox="-12 -12 24 24" className="sparkle" style={{ left: `${s.x}%`, top: `${s.y}%`, '--s': `${s.s}vmin`, '--d': `${i * 0.7}s` } as Pos}>
          <path d={SPARKLE} />
        </svg>
      ))}
      {variant === 'intro' && (
        <>
          <Flute side="l" />
          <Flute side="r" />
        </>
      )}
    </div>
  )
}
