import { AnimatePresence, motion } from 'motion/react'
import QRCode from 'qrcode'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Photo } from '../lib/types'
import { PolaroidFrame } from './Polaroid'
import { Logo } from './Logo'
import { BRAND } from '../brand/brand'

const APP_URL = `${location.origin}${import.meta.env.BASE_URL}`
const SLIDE_MS = 8000
const NEW_MS = 12000
const MAX = 40

/**
 * Big-screen slideshow for a projector or TV: cycles through the latest photos and jumps to each new one
 * as it arrives. Opened by an organizer from the panel, on a notebook already signed in.
 */
export function Telao({ photos, onClose }: { photos: Photo[]; onClose: () => void }) {
  const list = useMemo(
    () =>
      photos
        // the room never sees the organizers' test photos
        .filter((p) => !p.status && !p.test && (p.preview || p.url))
        .sort((a, b) => b.takenAt.getTime() - a.takenAt.getTime())
        .slice(0, MAX),
    [photos],
  )
  const [i, setI] = useState(0)
  const [fresh, setFresh] = useState<string>()
  const [qr, setQr] = useState<string>()
  const newest = list[0]?.id
  const seen = useRef(newest)

  // a new photo arrived: show it right away, a bit longer than the others
  useEffect(() => {
    if (!newest || newest === seen.current) return
    seen.current = newest
    setI(0)
    setFresh(newest)
  }, [newest])

  useEffect(() => {
    if (list.length < 2) return
    const t = setTimeout(() => {
      setFresh(undefined)
      setI((n) => (n + 1) % list.length)
    }, fresh ? NEW_MS : SLIDE_MS)
    return () => clearTimeout(t)
  }, [i, fresh, list.length])

  useEffect(() => {
    QRCode.toDataURL(APP_URL, { width: 360, margin: 1, errorCorrectionLevel: 'M', color: { dark: BRAND.colors.ink, light: '#fffdf7' } }).then(setQr, () => undefined)
  }, [])

  // fullscreen and keep the screen on; both may be refused, the slideshow works anyway
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    document.documentElement.requestFullscreen?.().catch(() => undefined)
    const keepOn = () => navigator.wakeLock?.request('screen').then((l) => (lock = l), () => undefined)
    keepOn()
    const back = () => document.visibilityState === 'visible' && keepOn()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('visibilitychange', back)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('keydown', esc)
      lock?.release().catch(() => undefined)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
    }
  }, [onClose])

  const p = list[Math.min(i, list.length - 1)]

  return (
    <div className="telao" onDoubleClick={onClose}>
      <header className="telao-head">
        <Logo small />
        <button className="btn ghost small telao-exit" onClick={onClose}>Sair do telão</button>
      </header>

      <div className="telao-stage">
        <AnimatePresence mode="wait">
          {p ? (
            <motion.div
              key={p.id}
              className="telao-slide"
              initial={{ opacity: 0, scale: 0.92, rotate: p.tilt * 2 - 3 }}
              animate={{ opacity: 1, scale: 1, rotate: p.tilt }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {p.id === fresh && <span className="telao-new">Acabou de chegar</span>}
              <PolaroidFrame frame={p.frame} className="telao-polaroid">
                <div className="polaroid-photo">
                  <img src={p.preview ?? p.url} alt={p.caption || `Foto de ${p.author}`} />
                </div>
                <figcaption>
                  {p.caption && <span className="telao-caption">{p.caption}</span>}
                  <span className="telao-author">{p.kind === 'look' ? 'Look de ' : 'por '}{p.author}</span>
                </figcaption>
              </PolaroidFrame>
            </motion.div>
          ) : (
            <motion.p key="empty" className="telao-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              As fotos aparecem aqui assim que alguém postar.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {qr && (
        <aside className="telao-qr">
          <img src={qr} alt="QR code do app" />
          <span>Aponta a câmera e<br />manda a sua</span>
        </aside>
      )}
    </div>
  )
}
