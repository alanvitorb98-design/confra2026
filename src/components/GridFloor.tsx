import { useEffect, useRef } from 'react'

interface Props {
  /** world units per second the floor scrolls toward the viewer */
  speed: number
}

const GRID = 1 // world spacing between lines
const NEAR = 0.6 // depth of the bottom edge of the screen
const FAR = 40

/**
 * Perspective grid drawn on canvas: lines fan out from the vanishing point and
 * cross-lines scroll toward the viewer.
 */
export function GridFloor({ speed }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let w = 0
    let h = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // depth z -> screen y (0 at horizon, h at the bottom edge)
    const yAt = (z: number) => (h * NEAR) / z
    // world x at depth z -> screen x
    const xAt = (x: number, z: number) => w / 2 + (x * w * 0.5 * NEAR) / z

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, '#2a0a4a')
      bg.addColorStop(1, '#12052a')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      ctx.lineWidth = 1.6
      ctx.strokeStyle = 'rgba(206,120,255,.95)'
      ctx.shadowColor = '#b45cff'
      ctx.shadowBlur = 8

      // lines running away from the viewer
      const span = Math.ceil((FAR * 2) / NEAR)
      for (let i = -span; i <= span; i++) {
        const x = i * GRID
        ctx.beginPath()
        ctx.moveTo(xAt(x, FAR), yAt(FAR))
        ctx.lineTo(xAt(x, NEAR), h)
        ctx.stroke()
      }

      // cross lines scrolling toward the viewer
      const phase = ((t / 1000) * speed) % GRID
      for (let z = NEAR + GRID - phase; z < FAR; z += GRID) {
        const y = yAt(z)
        ctx.globalAlpha = Math.min(1, y / 18)
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      ctx.shadowBlur = 0

      if (!reduced) raf = requestAnimationFrame(draw)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [speed])

  return <canvas ref={ref} className="grid-floor" />
}
