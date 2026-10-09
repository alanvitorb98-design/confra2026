import { motion } from 'motion/react'
import { Logo } from './Logo'
import { PartyScene } from './PartyScene'

/** Opening shot: fireworks pop around the invitation title, glasses slide in. Tap the button to go in. */
export function Splash({ onDone }: { onDone: () => void }) {
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
        <p className="splash-team">Equipe Derhu</p>
        <p className="splash-question">Preparado para a confraternização?</p>
        <p className="splash-date">07/11</p>
      </motion.div>

      <motion.button
        className="btn primary splash-go"
        onClick={onDone}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.7, type: 'spring', stiffness: 260, damping: 16 }}
        whileTap={{ scale: 0.94 }}
      >
        Bora!
      </motion.button>
    </motion.div>
  )
}
