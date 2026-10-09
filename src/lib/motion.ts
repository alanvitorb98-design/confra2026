import { useEffect, useRef } from 'react'

type MotionPermission = 'granted' | 'denied' | 'unsupported'

interface IOSDeviceMotionEvent {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/**
 * iOS only exposes the motion sensor after the user allows it, and the
 * request has to come straight from a tap. Android grants it silently.
 */
export async function requestMotionPermission(): Promise<MotionPermission> {
  if (typeof DeviceMotionEvent === 'undefined') return 'unsupported'
  const ios = DeviceMotionEvent as unknown as IOSDeviceMotionEvent
  if (typeof ios.requestPermission !== 'function') return 'granted'
  try {
    return await ios.requestPermission()
  } catch {
    return 'denied'
  }
}

/** Calls onShake with a 0..1 strength every time the phone is shaken hard enough. */
export function useShake(onShake: (strength: number) => void, enabled: boolean) {
  const cb = useRef(onShake)
  cb.current = onShake

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    let last = { x: 0, y: 0, z: 0 }
    let primed = false

    const handle = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (!a || a.x == null || a.y == null || a.z == null) return
      const now = { x: a.x, y: a.y, z: a.z }
      if (primed) {
        const delta = Math.abs(now.x - last.x) + Math.abs(now.y - last.y) + Math.abs(now.z - last.z)
        if (delta > 14) cb.current(Math.min(1, (delta - 14) / 26))
      }
      last = now
      primed = true
    }

    window.addEventListener('devicemotion', handle)
    return () => window.removeEventListener('devicemotion', handle)
  }, [enabled])
}

export function buzz(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}
