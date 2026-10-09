import type { CSSProperties } from 'react'

// Cream paper with gold confetti, fireworks and sparklers, after the party invitation.
// Everything is SVG or CSS so it stays crisp and cheap to paint on phones.

interface Props {
  /** intro: fireworks pop in one after another, glasses slide in; ambient: calm backdrop behind the app */
  variant: 'intro' | 'ambient'
}

type Pos = CSSProperties & { '--d'?: string; '--s'?: string }

// x/y in % of the screen, size in vmin
const DOTS: { x: number; y: number; s: number; pale?: boolean; ring?: boolean }[] = [
  { x: 6, y: 8, s: 6 }, { x: 22, y: 4, s: 3, pale: true }, { x: 30, y: 14, s: 4, ring: true }, { x: 64, y: 6, s: 2.5 },
  { x: 86, y: 18, s: 7, pale: true }, { x: 94, y: 40, s: 3 }, { x: 3, y: 36, s: 3.5, pale: true }, { x: 12, y: 58, s: 2.5 },
  { x: 90, y: 62, s: 5, ring: true }, { x: 80, y: 82, s: 3, pale: true }, { x: 8, y: 90, s: 4 }, { x: 46, y: 94, s: 8, pale: true },
  { x: 58, y: 30, s: 2 }, { x: 36, y: 72, s: 2.5, pale: true }, { x: 70, y: 52, s: 2 }, { x: 18, y: 24, s: 2, ring: true },
]

const STARS: { x: number; y: number; s: number }[] = [
  { x: 38, y: 7, s: 4 }, { x: 14, y: 44, s: 3 }, { x: 84, y: 48, s: 3.5 }, { x: 74, y: 12, s: 2.5 },
  { x: 26, y: 84, s: 3 }, { x: 62, y: 88, s: 2.5 }, { x: 52, y: 20, s: 2 },
]

const BURSTS: { x: number; y: number; s: number; rays: number }[] = [
  { x: 50, y: 0, s: 46, rays: 18 },
  { x: 96, y: 22, s: 34, rays: 14 },
  { x: 2, y: 22, s: 30, rays: 12 },
  { x: 10, y: 86, s: 34, rays: 16 },
  { x: 88, y: 84, s: 40, rays: 18 },
]

function Burst({ rays }: { rays: number }) {
  const lines = Array.from({ length: rays }, (_, i) => {
    const a = (i / rays) * Math.PI * 2
    const long = i % 2 === 0
    const r1 = long ? 34 : 40
    const r2 = long ? 88 : 70
    return { a, r1, r2, long }
  })
  return (
    <svg viewBox="-100 -100 200 200" className="burst-svg">
      <circle r="16" className="burst-core" />
      <circle r="26" className="burst-ring" />
      {lines.map(({ a, r1, r2, long }, i) => (
        <g key={i}>
          <line x1={Math.cos(a) * r1} y1={Math.sin(a) * r1} x2={Math.cos(a) * r2} y2={Math.sin(a) * r2} className="burst-ray" />
          {long && <circle cx={Math.cos(a) * (r2 + 7)} cy={Math.sin(a) * (r2 + 7)} r="4.5" className="burst-tip" />}
        </g>
      ))}
    </svg>
  )
}

const STAR = 'M12 0 L14.6 8.6 L24 9.2 L16.6 14.8 L19.4 24 L12 18.6 L4.6 24 L7.4 14.8 L0 9.2 L9.4 8.6 Z'

function Glass() {
  return (
    <svg viewBox="0 0 140 220" className="glass glass-wine">
      <defs>
        <clipPath id="wine-bowl"><path d="M18 18 C 8 110, 132 110, 122 18 Z" /></clipPath>
      </defs>
      <path d="M18 18 C 8 110, 132 110, 122 18 Z" className="glass-bowl" />
      <g clipPath="url(#wine-bowl)">
        <rect x="0" y="44" width="140" height="80" className="glass-wine-liquid" />
        <circle cx="48" cy="70" r="3" className="glass-bubble" /><circle cx="70" cy="58" r="2.2" className="glass-bubble" />
        <circle cx="92" cy="76" r="3.4" className="glass-bubble" /><circle cx="62" cy="88" r="2" className="glass-bubble" />
      </g>
      <path d="M18 18 C 8 110, 132 110, 122 18 Z" className="glass-line" />
      <path d="M70 89 L70 196 M38 202 Q70 190 102 202" className="glass-line" />
    </svg>
  )
}

function Martini() {
  return (
    <svg viewBox="0 0 160 220" className="glass glass-martini">
      <path d="M8 40 L152 40 L80 118 Z" className="glass-bowl" />
      <path d="M22 54 L138 54 L80 118 Z" className="glass-wine-liquid" />
      <path d="M8 40 L152 40 L80 118 Z M80 118 L80 198 M46 204 Q80 192 114 204" className="glass-line" />
      <path d="M40 66 L132 6" className="glass-line thin" />
      <circle cx="104" cy="24" r="10" className="olive" /><circle cx="122" cy="14" r="9" className="olive" />
    </svg>
  )
}

export function PartyScene({ variant }: Props) {
  return (
    <div className={`party party-${variant}`} aria-hidden>
      {BURSTS.map((b, i) => (
        <div key={`b${i}`} className="burst" style={{ left: `${b.x}%`, top: `${b.y}%`, '--s': `${b.s}vmin`, '--d': `${0.25 + i * 0.35}s` } as Pos}>
          <Burst rays={b.rays} />
        </div>
      ))}
      {DOTS.map((d, i) => (
        <span
          key={`d${i}`}
          className={`dot${d.pale ? ' pale' : ''}${d.ring ? ' ring' : ''}`}
          style={{ left: `${d.x}%`, top: `${d.y}%`, '--s': `${d.s}vmin`, '--d': `${(i % 6) * 0.45}s` } as Pos}
        />
      ))}
      {STARS.map((s, i) => (
        <svg key={`s${i}`} viewBox="0 0 24 24" className="star" style={{ left: `${s.x}%`, top: `${s.y}%`, '--s': `${s.s}vmin`, '--d': `${i * 0.6}s` } as Pos}>
          <path d={STAR} />
        </svg>
      ))}
      <svg viewBox="0 0 100 60" className="comet">
        <path d="M4 50 Q30 20 70 14 M10 58 Q36 30 74 24 M20 60 Q44 40 78 34" />
      </svg>
      <span className="sparkler sparkler-l" />
      <span className="sparkler sparkler-r" />
      {variant === 'intro' && (
        <>
          <Glass />
          <Martini />
        </>
      )}
    </div>
  )
}
