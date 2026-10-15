import { animate, motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { useEffect } from 'react'

const N = 6
const R = 30 // inner radius of the barrel, in viewBox units (viewBox is 64x64, centre 32,32)
const OPEN = 0.74
const SHUT = 0.02
const LOCKED = 0.3

/** Corners of the hexagonal opening for a given openness (0..1); it twists as it closes, like a real iris. */
function hex(open: number) {
  const r = R * open
  const twist = (1 - open) * 0.9
  return Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2 + twist
    return [32 + r * Math.cos(a), 32 + r * Math.sin(a)] as const
  })
}

/** One blade: from an edge of the opening out past the barrel along the edge's direction (clipped by the barrel). */
function blade(open: number, i: number) {
  const v = hex(open)
  const [ax, ay] = v[i]
  const [bx, by] = v[(i + 1) % N]
  const [cx, cy] = v[(i + 2) % N]
  const far = 60
  const d1 = norm(bx - ax, by - ay)
  const d2 = norm(cx - bx, cy - by)
  return `${ax},${ay} ${bx},${by} ${bx + d2[0] * far},${by + d2[1] * far} ${ax + d1[0] * far},${ay + d1[1] * far}`
}

function norm(x: number, y: number) {
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l]
}

function Blade({ open, i }: { open: MotionValue<number>; i: number }) {
  const points = useTransform(open, (o) => blade(o, i))
  return <motion.polygon points={points} className="shutter-blade" />
}

/**
 * The camera button: a lens with a six-blade iris. Pressing closes the iris, letting go snaps it shut and
 * open again; while the camera is off the iris stays half closed.
 */
export function Shutter({ disabled, label, onShoot }: { disabled: boolean; label: string; onShoot: () => void }) {
  const open = useMotionValue(disabled ? LOCKED : OPEN)

  useEffect(() => {
    const c = animate(open, disabled ? LOCKED : OPEN, { type: 'spring', stiffness: 160, damping: 18 })
    return () => c.stop()
  }, [disabled, open])

  const press = () => !disabled && animate(open, 0.42, { duration: 0.12, ease: 'easeOut' })
  const release = () => !disabled && animate(open, OPEN, { type: 'spring', stiffness: 260, damping: 20 })
  const fire = () => {
    if (disabled) return
    onShoot()
    // snap shut, then open with a little overshoot
    void animate(open, [open.get(), SHUT, SHUT, OPEN], { duration: 0.55, times: [0, 0.22, 0.4, 1], ease: ['easeIn', 'linear', [0.2, 1.4, 0.4, 1]] })
  }

  return (
    <button
      className="shutter"
      onPointerDown={press}
      onPointerLeave={release}
      onPointerCancel={release}
      onClick={fire}
      disabled={disabled}
      aria-label={label}
    >
      <svg viewBox="0 0 64 64" aria-hidden>
        <defs>
          <radialGradient id="lens-glass" cx="38%" cy="34%" r="70%">
            <stop offset="0" stopColor="#6d5f4c" />
            <stop offset=".35" stopColor="#2a241c" />
            <stop offset="1" stopColor="#050403" />
          </radialGradient>
          <linearGradient id="blade-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b342b" />
            <stop offset=".5" stopColor="#1d1a16" />
            <stop offset="1" stopColor="#2c261f" />
          </linearGradient>
          <clipPath id="barrel">
            <circle cx="32" cy="32" r={R} />
          </clipPath>
        </defs>
        {/* glass behind the iris, with the lens's coloured reflections */}
        <circle cx="32" cy="32" r={R} fill="url(#lens-glass)" />
        <circle cx="32" cy="32" r="13" fill="none" stroke="#7d5fb8" strokeOpacity=".35" strokeWidth="1.2" />
        <circle cx="32" cy="32" r="8" fill="none" stroke="#3fa58f" strokeOpacity=".35" strokeWidth="1" />
        <ellipse cx="26" cy="24" rx="6" ry="3.4" transform="rotate(-35 26 24)" fill="#fff" fillOpacity=".28" />
        <circle cx="38.5" cy="37" r="1.5" fill="#fff" fillOpacity=".22" />
        <g clipPath="url(#barrel)">
          {Array.from({ length: N }, (_, i) => (
            <Blade key={i} open={open} i={i} />
          ))}
        </g>
        {/* the barrel's inner lip */}
        <circle cx="32" cy="32" r={R} fill="none" stroke="#000" strokeOpacity=".7" strokeWidth="1.6" />
        <circle cx="32" cy="32" r={R - 1.4} fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth=".8" />
      </svg>
    </button>
  )
}
