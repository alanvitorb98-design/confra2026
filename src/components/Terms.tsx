import { motion } from 'motion/react'
import { useState } from 'react'
import { TERMS_KEY, TERMS_VERSION } from '../lib/terms'

/** The house rules, shown once after the opening screen. Short on purpose, but it is the guest's consent. */
export function Terms({ onAccept }: { onAccept: () => void }) {
  const [ok, setOk] = useState(false)
  return (
    <motion.div className="terms" role="dialog" aria-label="Combinados da festa" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
      <div className="terms-card panel">
        <b>Antes de entrar, os combinados</b>
        <ul>
          <li>As fotos que você posta aparecem pra todos os convidados e podem ir pro álbum final. A organização pode tirar do ar o que não combinar com a festa.</li>
          <li>Poste só fotos que você tirou, com quem topou aparecer. Nada ofensivo.</li>
          <li>O reconhecimento facial é opcional. A selfie vira uma assinatura numérica usada só pra te achar nas fotos daqui, e é apagada depois da festa.</li>
          <li><strong>Não use selfie de crianças nem de menores de 16 anos.</strong></li>
          <li>A localização (GPS) sai das fotos antes do envio.</li>
          <li>Você pode apagar suas fotos e sair do reconhecimento quando quiser, em Eu.</li>
          <li>As fotos ficam no ar um tempo depois da festa pra todo mundo baixar, e depois são apagadas.</li>
        </ul>
        <label className="terms-check">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>Li e topo os combinados</span>
        </label>
        <button
          className="btn primary wide"
          disabled={!ok}
          onClick={() => {
            try {
              localStorage.setItem(TERMS_KEY, TERMS_VERSION)
            } catch {
              /* private mode: asked again next time */
            }
            onAccept()
          }}
        >
          Entrar
        </button>
      </div>
    </motion.div>
  )
}
