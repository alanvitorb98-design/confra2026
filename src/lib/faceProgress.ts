import type { FaceProgress } from './backend'

// The face server takes about a minute to start when it is off (about 53 s measured), then a few seconds per selfie.
const BOOT_S = 35

/** Percent and label for the bar: sending, starting the server (estimated by time), in line, reading, done. */
export function progressOf(sending: boolean, p: FaceProgress | undefined, since: number, now: number) {
  const t = Math.max(0, (now - since) / 1000)
  if (sending) return { pct: Math.min(18, 4 + t * 6), label: 'Enviando a selfie…' }
  if (!p || p.status !== 'pending') return null
  if (p.reading) return { pct: 92, label: 'Lendo seu rosto…' }
  if (p.worker && p.ahead > 0) return { pct: 84, label: p.ahead === 1 ? '1 selfie na sua frente…' : `${p.ahead} selfies na sua frente…` }
  if (p.worker) return { pct: 86, label: 'Quase lá…' }
  return { pct: 20 + 60 * (1 - Math.exp(-t / BOOT_S)), label: 'Ligando o reconhecimento…' }
}
