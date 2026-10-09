/*
 * Adapted from React Bits "ClickSpark" (https://reactbits.dev), by David Haz.
 * MIT + Commons Clause License Condition v1.0. Copyright (c) 2026 David Haz.
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * Changes: sparks alternate between two colors and fire on pointerdown so they
 * land under the finger on touch screens.
 */
import { useCallback, useEffect, useRef, type ReactNode } from 'react'

interface Spark {
  x: number
  y: number
  angle: number
  startTime: number
  color: string
}

interface Props {
  colors?: string[]
  sparkSize?: number
  sparkRadius?: number
  sparkCount?: number
  duration?: number
  className?: string
  children?: ReactNode
}

export default function ClickSpark({
  colors = ['#ff3d9a', '#38e1ff'],
  sparkSize = 12,
  sparkRadius = 26,
  sparkCount = 10,
  duration = 450,
  className,
  children,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sparksRef = useRef<Spark[]>([])
  const running = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return
    const resize = () => {
      const { width, height } = parent.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    resize()
    return () => ro.disconnect()
  }, [])

  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      sparksRef.current = sparksRef.current.filter((s) => {
        const elapsed = timestamp - s.startTime
        if (elapsed >= duration) return false
        const t = elapsed / duration
        const eased = t * (2 - t)
        const distance = eased * sparkRadius
        const length = sparkSize * (1 - eased)
        ctx.strokeStyle = s.color
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.shadowColor = s.color
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(s.x + distance * Math.cos(s.angle), s.y + distance * Math.sin(s.angle))
        ctx.lineTo(s.x + (distance + length) * Math.cos(s.angle), s.y + (distance + length) * Math.sin(s.angle))
        ctx.stroke()
        return true
      })
      if (sparksRef.current.length) requestAnimationFrame(draw)
      else running.current = false
    },
    [duration, sparkRadius, sparkSize],
  )

  const fire = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const now = performance.now()
    for (let i = 0; i < sparkCount; i++) {
      sparksRef.current.push({ x, y, angle: (2 * Math.PI * i) / sparkCount, startTime: now, color: colors[i % colors.length] })
    }
    if (!running.current) {
      running.current = true
      requestAnimationFrame(draw)
    }
  }

  return (
    <div className={className} style={{ position: 'relative' }} onPointerDown={fire}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: -30, width: 'calc(100% + 60px)', height: 'calc(100% + 60px)', pointerEvents: 'none', zIndex: 3 }} />
      {children}
    </div>
  )
}
