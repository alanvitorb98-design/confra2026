import { useCallback, useEffect, useRef, useState } from 'react'
import { buzz, requestMotionPermission, useShake } from '../lib/motion'
import { playReveal } from '../lib/sound'

interface Props {
  file: File
  onPost: (caption: string) => void
  onDiscard: () => void
}

type Stage = 'zoom' | 'develop' | 'done'

const HOLD_MS = 2200
const needsMotionPrompt =
  typeof DeviceMotionEvent !== 'undefined' &&
  typeof (DeviceMotionEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function'
let motionAllowed = !needsMotionPrompt

/** The moment after the shutter: the shot zooms out into a dark Polaroid and develops on shake or hold. */
export function Develop({ file, onPost, onDiscard }: Props) {
  const [url] = useState(() => URL.createObjectURL(file))
  const [stage, setStage] = useState<Stage>('zoom')
  const [progress, setProgress] = useState(0)
  const [caption, setCaption] = useState('')
  const [canShake, setCanShake] = useState(motionAllowed)
  const holding = useRef(false)
  const raf = useRef(0)

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  useEffect(() => {
    const t = setTimeout(() => setStage('develop'), 900)
    return () => clearTimeout(t)
  }, [])

  const advance = useCallback((amount: number) => {
    setProgress((p) => Math.min(1, p + amount))
  }, [])

  useEffect(() => {
    if (stage === 'develop' && progress >= 1) {
      holding.current = false
      setStage('done')
      buzz([30, 40, 80])
      playReveal()
    }
  }, [progress, stage])

  useShake(
    (strength) => {
      advance(0.1 + strength * 0.12)
      buzz(15)
    },
    stage === 'develop' && canShake,
  )

  const startHold = () => {
    if (stage !== 'develop') return
    holding.current = true
    let last = performance.now()
    const tick = (now: number) => {
      if (!holding.current) return
      advance((now - last) / HOLD_MS)
      last = now
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const stopHold = () => {
    holding.current = false
    cancelAnimationFrame(raf.current)
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const enableShake = async () => {
    const result = await requestMotionPermission()
    motionAllowed = result === 'granted'
    setCanShake(motionAllowed)
  }

  return (
    <div className={`develop stage-${stage}`} style={{ '--p': progress } as React.CSSProperties}>
      <div className="develop-flash" aria-hidden />
      <div className="develop-hint">
        {stage === 'done' ? (
          <span className="hint-done">Revelou!</span>
        ) : canShake ? (
          <span>Chacoalha ou segura a foto pra revelar</span>
        ) : (
          <span>Segura a foto pra revelar</span>
        )}
      </div>

      <figure
        className="polaroid polaroid-dark develop-polaroid"
        onPointerDown={startHold}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="polaroid-photo">
          <img src={url} alt="Sua foto" draggable={false} />
          <div className="develop-veil" aria-hidden />
        </div>
        <figcaption>
          {stage === 'done' ? (
            <input
              id="caption"
              className="caption-input"
              placeholder="escreve uma legenda…"
              maxLength={60}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="develop-meter" aria-label={`Revelando ${Math.round(progress * 100)}%`}>
              <span style={{ width: `${progress * 100}%` }} />
            </span>
          )}
        </figcaption>
      </figure>

      <div className="develop-actions">
        {stage === 'done' ? (
          <>
            <button className="btn ghost" onClick={onDiscard}>Descartar</button>
            <button className="btn neon" onClick={() => onPost(caption.trim())}>Postar no feed</button>
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={onDiscard}>Cancelar</button>
            {!canShake && needsMotionPrompt && (
              <button className="btn ghost" onClick={enableShake}>Ativar chacoalhar</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
