import { motion } from 'motion/react'
import { useState } from 'react'
import { Logo } from './Logo'
import { PartyScene } from '../brand/PartyScene'
import { termsAccepted } from '../lib/terms'
import { Terms } from './Terms'
import { BRAND } from '../brand/brand'

/** Opening shot: the event's title over its scene (src/brand/PartyScene). Tap the button to go in. */
export function Splash({ onDone }: { onDone: () => void }) {
  const [terms, setTerms] = useState(false)
  return (
    <motion.div className="splash" exit={{ opacity: 0 }}>
      <PartyScene variant="intro" />

      <motion.div
        className="splash-title"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.9, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Logo />
        <p className="splash-team">{BRAND.subtitle}</p>
        <p className="splash-question">{BRAND.question}</p>
        <p className="splash-date">{BRAND.dateLabel}</p>
      </motion.div>

      <motion.button
        className="btn primary splash-go"
        onClick={() => (termsAccepted() ? onDone() : setTerms(true))}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.7, type: 'spring', stiffness: 260, damping: 16 }}
        whileTap={{ scale: 0.94 }}
      >
        {BRAND.enter}
      </motion.button>
      {terms && <Terms onAccept={onDone} />}
    </motion.div>
  )
}
