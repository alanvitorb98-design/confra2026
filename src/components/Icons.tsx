import { motion } from 'motion/react'
import type { Reaction } from '../lib/types'

/*
 * The app's own icons, drawn in the same ink-and-gold line as the invitation's fireworks and glasses
 * (round caps, slightly uneven strokes, flat gold fills) instead of a stock icon set or system emoji.
 */

const ink = 'var(--ink)'
const gold = 'var(--gold)'
const goldHi = 'var(--gold-hi)'
const line = { fill: 'none', stroke: ink, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export type TabIconName = 'feed' | 'missions' | 'ranking' | 'me'

/** Tab bar icons. Each one does a small move of its own when its tab becomes the current one. */
export function TabIcon({ name, active }: { name: TabIconName; active: boolean }) {
  const spring = { type: 'spring', stiffness: 420, damping: 14 } as const
  return (
    <svg className="tab-icon" viewBox="0 0 28 28" aria-hidden>
      {name === 'feed' && (
        <>
          {/* two Polaroids: the back one sits still, the front one swings in */}
          <rect x="5" y="5.5" width="13" height="15.5" rx="1.2" transform="rotate(-9 11.5 13)" {...line} fill="#fffdf7" />
          <motion.g style={{ originX: 0.6, originY: 0.9 }} initial={false} animate={active ? { rotate: [0, 12, 6] } : { rotate: 6 }} transition={{ duration: 0.5 }}>
            <rect x="10" y="6.5" width="13" height="15.5" rx="1.2" {...line} fill="#fffdf7" />
            <rect x="12" y="8.5" width="9" height="8.5" rx=".6" fill={active ? gold : 'none'} stroke={ink} strokeWidth="1.3" />
            <circle cx="18.6" cy="10.8" r="1.1" fill={active ? goldHi : 'none'} stroke={ink} strokeWidth="1" />
          </motion.g>
        </>
      )}
      {name === 'missions' && (
        <>
          {/* a ticket stub with a star punched in */}
          <path d="M4.5 9.2c0-1 .8-1.8 1.8-1.8h15.4c1 0 1.8.8 1.8 1.8v2.1a2.7 2.7 0 0 0 0 5.4v2.1c0 1-.8 1.8-1.8 1.8H6.3c-1 0-1.8-.8-1.8-1.8v-2.1a2.7 2.7 0 0 0 0-5.4z" {...line} />
          <path d="M9.6 7.6v12.8" {...line} strokeDasharray="1.4 2" strokeWidth="1.2" />
          <motion.path
            d="M16.6 10.3l1.1 2.2 2.4.35-1.75 1.7.42 2.4-2.17-1.14-2.17 1.14.42-2.4-1.75-1.7 2.4-.35z"
            fill={active ? gold : 'none'}
            stroke={ink}
            strokeWidth="1.3"
            strokeLinejoin="round"
            style={{ originX: 0.5, originY: 0.55 }}
            initial={false}
            animate={active ? { rotate: [0, 72], scale: [1, 1.35, 1] } : { rotate: 0, scale: 1 }}
            transition={{ duration: 0.55 }}
          />
        </>
      )}
      {name === 'ranking' && (
        <>
          {/* podium: the blocks rise from the floor */}
          <path d="M3.5 23h21" {...line} />
          {[
            { x: 4.8, h: 7.5, d: 0.08 },
            { x: 10.8, h: 11.5, d: 0 },
            { x: 16.8, h: 5, d: 0.16 },
          ].map((b) => (
            <motion.rect
              key={`${b.x}${active}`}
              x={b.x}
              width="6.4"
              rx=".8"
              {...line}
              fill={b.h === 11.5 && active ? gold : '#fffdf7'}
              initial={active ? { y: 23, height: 0 } : false}
              animate={{ y: 23 - b.h, height: b.h }}
              transition={{ ...spring, delay: b.d }}
            />
          ))}
          <motion.path
            d="M14 3.2l.8 1.6 1.8.26-1.3 1.27.3 1.78-1.6-.85-1.6.85.3-1.78-1.3-1.27 1.8-.26z"
            fill={gold}
            stroke={ink}
            strokeWidth="1"
            strokeLinejoin="round"
            initial={false}
            animate={active ? { y: [6, -1, 0], opacity: [0, 1, 1] } : { y: 0, opacity: 0.0001 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          />
        </>
      )}
      {name === 'me' && (
        <>
          {/* a face in a party hat; the hat tips and throws two sparks */}
          <circle cx="14" cy="17" r="6.6" {...line} fill="#fffdf7" />
          <path d="M11.4 16.2v.4M16.6 16.2v.4" {...line} strokeWidth="2" />
          <path d="M11.6 19.2c1.3 1.2 3.5 1.2 4.8 0" {...line} />
          <motion.g style={{ originX: 0.5, originY: 1 }} initial={false} animate={active ? { rotate: [0, -16, -8] } : { rotate: 0 }} transition={{ duration: 0.5 }}>
            <path d="M10.4 10.8L14 2.8l3.6 8z" fill={active ? gold : '#fffdf7'} stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M12 7.2l3.2 1.4" stroke={ink} strokeWidth="1.1" strokeLinecap="round" />
            <circle cx="14" cy="2.6" r="1.2" fill={goldHi} stroke={ink} strokeWidth="1" />
          </motion.g>
          {active &&
            [
              { x: 6, y: 6, dx: -2, dy: -2 },
              { x: 22, y: 8, dx: 2, dy: -2 },
            ].map((s, i) => (
              <motion.circle
                key={i}
                cx={s.x}
                cy={s.y}
                r="1"
                fill={gold}
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{ opacity: [0, 1, 0], x: s.dx, y: s.dy }}
                transition={{ duration: 0.6, delay: 0.2 }}
              />
            ))}
        </>
      )}
    </svg>
  )
}

/**
 * Reactions, drawn instead of system emoji. The value stored stays the emoji, so nothing changes in the
 * data; `pop` plays the reaction's own move (flame flares, face shakes with laughter, heart beats,
 * glasses clink).
 */
export function ReactionIcon({ r, pop = false, size = 24 }: { r: Reaction; pop?: boolean; size?: number }) {
  const play = pop ? 'pop' : 'rest'
  return (
    <svg className="reaction-icon" viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      {r === '🔥' && (
        <motion.g style={{ originX: 0.5, originY: 1 }} initial={pop ? 'rest' : false} animate={play} variants={{ rest: { scaleY: 1, scaleX: 1 }, pop: { scaleY: [1, 1.25, 0.92, 1.08, 1], scaleX: [1, 0.9, 1.06, 0.97, 1] } }} transition={{ duration: 0.6 }}>
          <path d="M16 28.5c-5.6 0-9-3.7-9-8.4 0-4.4 3.2-6.8 4.4-10.6.5 2 1.4 3.3 2.6 4C14 9.4 15.7 5.4 19.6 3c-.6 3.8 1 6.3 2.9 8.6 1.6 2 2.5 4.2 2.5 7.1 0 5.4-3.8 9.8-9 9.8z" fill="#e8743b" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M16.2 28c-2.7 0-4.4-1.8-4.4-4.2 0-2.5 2-3.7 2.8-6 1 1.4 1.4 2.4 2.8 3.2.6-1.2 1.2-2 2.3-2.6.4 1.6 1.2 2.6 1.2 4.6 0 2.8-2 5-4.7 5z" fill={goldHi} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        </motion.g>
      )}
      {r === '😂' && (
        <motion.g style={{ originX: 0.5, originY: 0.5 }} initial={pop ? 'rest' : false} animate={play} variants={{ rest: { rotate: 0 }, pop: { rotate: [0, -12, 10, -8, 6, 0] } }} transition={{ duration: 0.6 }}>
          <circle cx="16" cy="16" r="11.5" fill={gold} stroke={ink} strokeWidth="1.6" />
          <path d="M9.6 12.6l2.6 1.4-2.6 1.3M22.4 12.6L19.8 14l2.6 1.3" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.8 18.2h12.4c-.5 3.8-3 6-6.2 6s-5.7-2.2-6.2-6z" fill="#7a2e1f" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M12.6 22.3c1.1-.9 2.2-1.3 3.4-1.3s2.3.4 3.4 1.3" fill="none" stroke="#f08a7a" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M6.4 15.2c-1.2 1.6-1.7 3-1.2 4 .5.9 1.6.9 2.2.1.6-.9.2-2.4-1-4.1zM25.6 15.2c1.2 1.6 1.7 3 1.2 4-.5.9-1.6.9-2.2.1-.6-.9-.2-2.4 1-4.1z" fill="#8fd0e8" stroke={ink} strokeWidth="1.1" strokeLinejoin="round" />
        </motion.g>
      )}
      {r === '😍' && (
        <motion.g style={{ originX: 0.5, originY: 0.5 }} initial={pop ? 'rest' : false} animate={play} variants={{ rest: { scale: 1 }, pop: { scale: [1, 1.3, 0.95, 1.15, 1] } }} transition={{ duration: 0.65 }}>
          <path d="M16 27.5S4.5 20.6 4.5 12.4C4.5 8.6 7.3 6 10.5 6c2.3 0 4.3 1.3 5.5 3.3C17.2 7.3 19.2 6 21.5 6c3.2 0 6 2.6 6 6.4 0 8.2-11.5 15.1-11.5 15.1z" fill="#e0525c" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9 11.2c.3-1.6 1.5-2.6 3-2.7" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.6" strokeLinecap="round" />
        </motion.g>
      )}
      {r === '🥂' && (
        <>
          <motion.g style={{ originX: 0.5, originY: 1 }} initial={pop ? 'rest' : false} animate={play} variants={{ rest: { rotate: -10 }, pop: { rotate: [-10, 6, -14, -10] } }} transition={{ duration: 0.5 }}>
            <path d="M7.2 5h7.6l-.6 7.6a3.2 3.2 0 0 1-6.4 0z" fill="#fbe7a4" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M7.5 9h7" stroke={ink} strokeWidth="1.1" />
            <path d="M11 15.8v9.5M8 26.5h6" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          </motion.g>
          <motion.g style={{ originX: 0.5, originY: 1 }} initial={pop ? 'rest' : false} animate={play} variants={{ rest: { rotate: 10 }, pop: { rotate: [10, -6, 14, 10] } }} transition={{ duration: 0.5 }}>
            <path d="M17.2 5h7.6l-.6 7.6a3.2 3.2 0 0 1-6.4 0z" fill="#fbe7a4" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M17.5 9h7" stroke={ink} strokeWidth="1.1" />
            <path d="M21 15.8v9.5M18 26.5h6" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
          </motion.g>
          <motion.path d="M16 1.5v2.2M13.2 2.4l.9 1.6M18.8 2.4l-.9 1.6" fill="none" stroke={gold} strokeWidth="1.5" strokeLinecap="round" initial={pop ? 'rest' : false} animate={play} variants={{ rest: { opacity: 0 }, pop: { opacity: [0, 1, 0], y: [1, -1, -2] } }} transition={{ duration: 0.5, delay: 0.12 }} />
        </>
      )}
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg className="mini-icon" viewBox="0 0 20 20" aria-hidden>
      <rect x="4.5" y="8.5" width="11" height="8.5" rx="1.8" fill={goldHi} stroke={ink} strokeWidth="1.5" />
      <path d="M7 8.5V6.6a3 3 0 0 1 6 0v1.9" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 11.8v1.8" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** A check that draws itself, for things just done. */
export function CheckIcon() {
  return (
    <svg className="mini-icon" viewBox="0 0 20 20" aria-hidden>
      <motion.path d="M4.5 10.5l3.6 3.4 7.4-8" fill="none" stroke="var(--gold-deep)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }} />
    </svg>
  )
}

/** Empty selfie slot: a little Polaroid with a face waiting, and a flash that twinkles now and then. */
export function SelfieIcon() {
  return (
    <svg viewBox="0 0 58 58" aria-hidden>
      <g transform="rotate(-6 29 30)">
        <rect x="12" y="8" width="34" height="42" rx="2" fill="#fffdf7" stroke={ink} strokeWidth="1.7" />
        <rect x="16" y="12" width="26" height="26" fill="#f3e3b3" stroke={ink} strokeWidth="1.3" />
        <circle cx="29" cy="22.5" r="5" fill="none" stroke={ink} strokeWidth="1.6" />
        <path d="M20 38c1.2-5 4.6-7.6 9-7.6s7.8 2.6 9 7.6" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M20 44.5h10" stroke={ink} strokeWidth="1.3" strokeLinecap="round" strokeOpacity=".5" />
      </g>
      <motion.path
        d="M47 5l1.4 3.6L52 10l-3.6 1.4L47 15l-1.4-3.6L42 10l3.6-1.4z"
        fill={gold}
        stroke={ink}
        strokeWidth="1"
        strokeLinejoin="round"
        style={{ originX: 0.5, originY: 0.5 }}
        animate={{ scale: [0.6, 1.15, 0.6], rotate: [0, 45, 90], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  )
}
