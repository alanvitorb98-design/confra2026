import { motion } from 'motion/react'

// Ridge lines in a 400x120 box, back range first. Kept as data so both the fill and the neon edge use them.
const BACK = 'M0 120 L0 70 L40 52 L78 66 L120 30 L160 58 L196 40 L236 64 L278 22 L318 54 L356 38 L400 60 L400 120 Z'
const FRONT = 'M0 120 L0 92 L34 78 L70 96 L112 62 L150 88 L190 74 L226 98 L262 70 L300 90 L340 66 L374 86 L400 80 L400 120 Z'

/** Opening shot: the sun rises behind neon mountains while the road runs toward you. Tap the button to go in. */
export function Splash({ onDone }: { onDone: () => void }) {
  return (
    <motion.div className="splash" exit={{ opacity: 0 }}>
      <div className="splash-sky" />
      <div className="splash-stars" />
      <div className="splash-sun" />

      <svg className="splash-mountains" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="mt-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a1670" />
            <stop offset="1" stopColor="#14082a" />
          </linearGradient>
          <linearGradient id="mt-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#24104a" />
            <stop offset="1" stopColor="#0d0620" />
          </linearGradient>
        </defs>
        <path d={BACK} fill="url(#mt-back)" />
        <path d={BACK} fill="none" stroke="#ff3d9a" strokeWidth="1.2" vectorEffect="non-scaling-stroke" className="ridge" />
        <path d={FRONT} fill="url(#mt-front)" />
        <path d={FRONT} fill="none" stroke="#38e1ff" strokeWidth="1.2" vectorEffect="non-scaling-stroke" className="ridge" />
      </svg>

      <div className="splash-ground">
        <div className="splash-floor">
          <div className="splash-road">
            <span className="road-edge left" />
            <span className="road-lane" />
            <span className="road-edge right" />
          </div>
        </div>
      </div>

      <motion.div
        className="splash-title"
        initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ delay: 1.4, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <h1 className="logo">CONFRA<span>26</span></h1>
        <p className="splash-question">Preparado para a confraternização?</p>
      </motion.div>

      <motion.button
        className="btn neon splash-go"
        onClick={onDone}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 2.1, type: 'spring', stiffness: 260, damping: 16 }}
        whileTap={{ scale: 0.94 }}
      >
        Bora!
      </motion.button>
    </motion.div>
  )
}
