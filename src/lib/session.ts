import { useEffect, useState } from 'react'

/** State that survives a reload or the phone reopening the app (it lasts while the tab does). */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = sessionStorage.getItem(key)
      return saved === null ? initial : (JSON.parse(saved) as T)
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      if (value === undefined) sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* private mode: kept until the page closes */
    }
  }, [key, value])
  return [value, setValue] as const
}
