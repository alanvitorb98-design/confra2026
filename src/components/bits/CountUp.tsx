/*
 * Adapted from React Bits "CountUp" (https://reactbits.dev), by David Haz.
 * MIT + Commons Clause License Condition v1.0. Copyright (c) 2026 David Haz.
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * Changes: trimmed to counting up from zero with pt-BR number formatting.
 */
import { useInView, useMotionValue, useSpring } from 'motion/react'
import { useEffect, useRef } from 'react'

export default function CountUp({ to, duration = 1.2, className }: { to: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const value = useMotionValue(0)
  const spring = useSpring(value, { damping: 20 + 40 / duration, stiffness: 100 / duration })
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (inView) value.set(to)
  }, [inView, to, value])

  useEffect(
    () =>
      spring.on('change', (v) => {
        if (ref.current) ref.current.textContent = Math.round(v).toLocaleString('pt-BR')
      }),
    [spring],
  )

  return (
    <span className={className} ref={ref}>
      0
    </span>
  )
}
