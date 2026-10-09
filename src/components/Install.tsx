import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const ua = navigator.userAgent
const isIOS = /iphone|ipad|ipod/i.test(ua)
const isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|edgios|fxios|instagram|fban|fbav/i.test(ua)
// Chrome and Edge on iOS 16.4+ can add to the home screen from their own share button
const isIOSChromium = isIOS && /crios|edgios/i.test(ua)
const inAppBrowser = /instagram|fban|fbav|whatsapp|line\//i.test(ua)

/** Black screen shown in the browser before the intro: puts the app on the home screen first. */
export function Install({ onSkip }: { onSkip: () => void }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    const onInstalled = () => setDone(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setDone(true)
    setPrompt(null)
  }

  const steps = inAppBrowser
    ? [
        'Toque nos três pontinhos no canto da tela.',
        isIOS ? 'Escolha "Abrir no Safari".' : 'Escolha "Abrir no navegador" ou "Abrir no Chrome".',
        'Lá, siga as instruções que vão aparecer.',
      ]
    : isIOS
      ? [
          isIOSSafari
            ? 'Toque em Compartilhar, o quadrado com a seta pra cima, na barra do Safari.'
            : isIOSChromium
              ? 'Toque em Compartilhar, o quadrado com a seta pra cima, ao lado do endereço do site.'
              : 'Abra este link no Safari ou no Chrome, que são os que instalam no iPhone.',
          'Role e toque em "Adicionar à Tela de Início".',
          'Toque em "Adicionar" e abra a Confra 26 pelo ícone.',
        ]
      : [
          'Toque nos três pontinhos do Chrome, no canto de cima.',
          'Escolha "Instalar app" ou "Adicionar à tela inicial".',
          'Confirme e abra a Confra 26 pelo ícone.',
        ]

  return (
    <div className="install-gate">
      <motion.div className="install-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
        <img className="install-icon" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={84} height={84} />
        <h1 className="install-title">Coloca a Confra 26 na sua tela inicial</h1>
        <p className="install-lead">Assim ela abre em tela cheia, igual a um app, e você não perde nada da festa.</p>

        {done ? (
          <p className="install-done">Instalado! Agora abre pelo ícone na sua tela inicial.</p>
        ) : prompt ? (
          <button className="btn neon wide" onClick={install}>Instalar app</button>
        ) : (
          <ol className="install-steps">
            {steps.map((s, i) => (
              <li key={i}>
                <span className="install-n">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}

        <p className="install-note">É grátis, não pede nenhuma permissão especial e não passa pela loja de apps.</p>
        <button className="install-skip" onClick={onSkip}>Continuar no navegador</button>
      </motion.div>
    </div>
  )
}
