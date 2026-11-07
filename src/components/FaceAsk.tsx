import { motion } from 'motion/react'

/** Asked once, on reopening the app during the party, of a guest who has no selfie: face matching stays opt-in. */
export function FaceAsk({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <motion.div className="terms" role="dialog" aria-label="Seu rosto não está sendo reconhecido" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
      <div className="terms-card panel">
        <b>Seu rosto não está sendo reconhecido</b>
        <p>Você não ligou o reconhecimento, então o app não acha você nas fotos da festa e você não conta no ranking de quem mais aparece. Pra ligar, é só tirar uma selfie. Ela fica escondida: ninguém vê.</p>
        <button className="btn primary" onClick={onYes}>Ligar agora</button>
        <button className="btn ghost" onClick={onNo}>Continuar sem</button>
      </div>
    </motion.div>
  )
}
