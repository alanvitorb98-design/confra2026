import { useEffect, useRef } from 'react'

interface Props {
  /** world units per second the floor scrolls toward the viewer */
  speed: number
  road?: boolean
}

const GRID = 1 // world spacing between lines
const NEAR = 0.6 // depth of the bottom edge of the screen
const FAR = 40
const ROAD_HALF = 0.9

/**
 * Perspective grid drawn on canvas: lines fan out from the vanishing point and
 * cross-lines scroll toward the viewer, with an optional neon road down the middle.
 */
export function GridFloor({ speed, road = false }: Props) {
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
        if (road && Math.abs(x) < ROAD_HALF) continue
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

      if (road) {
        // asphalt
        ctx.shadowBlur = 0
        const asphalt = ctx.createLinearGradient(0, 0, 0, h)
        asphalt.addColorStop(0, '#120826')
        asphalt.addColorStop(1, '#07030f')
        ctx.fillStyle = asphalt
        ctx.beginPath()
        ctx.moveTo(xAt(-ROAD_HALF, FAR), yAt(FAR))
        ctx.lineTo(xAt(ROAD_HALF, FAR), yAt(FAR))
        ctx.lineTo(xAt(ROAD_HALF, NEAR), h)
        ctx.lineTo(xAt(-ROAD_HALF, NEAR), h)
        ctx.closePath()
        ctx.fill()

        // pink edges
        ctx.strokeStyle = '#ff5ab8'
        ctx.shadowColor = '#ff5ab8'
        ctx.shadowBlur = 16
        ctx.lineWidth = 3
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.moveTo(xAt(side * ROAD_HALF, FAR), yAt(FAR))
          ctx.lineTo(xAt(side * ROAD_HALF, NEAR), h)
          ctx.stroke()
        }

        // lane dashes, scrolling with the grid
        ctx.fillStyle = '#fff3a0'
        ctx.shadowColor = 'rgba(255,240,150,.8)'
        ctx.shadowBlur = 10
        const dash = 0.9
        const gap = 1.1
        const dPhase = ((t / 1000) * speed) % (dash + gap)
        for (let z = NEAR - dPhase; z < FAR; z += dash + gap) {
          const z1 = Math.max(z, NEAR * 0.98)
          const z2 = z + dash
          if (z2 <= z1) continue
          const hw = 0.05
          ctx.beginPath()
          ctx.moveTo(xAt(-hw, z2), yAt(z2))
          ctx.lineTo(xAt(hw, z2), yAt(z2))
          ctx.lineTo(xAt(hw, z1), yAt(z1))
          ctx.lineTo(xAt(-hw, z1), yAt(z1))
          ctx.closePath()
          ctx.fill()
        }
      }
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
  }, [speed, road])

  return <canvas ref={ref} className="grid-floor" />
}
