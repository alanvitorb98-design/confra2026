import { motion } from 'motion/react'
import { SynthScene } from './SynthScene'

/** Opening shot: the sun rises behind neon mountains while the grid floor rushes toward you. Tap the button to go in. */
export function Splash({ onDone }: { onDone: () => void }) {
  return (
    <motion.div className="splash" exit={{ opacity: 0 }}>
      <SynthScene variant="intro" />

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
