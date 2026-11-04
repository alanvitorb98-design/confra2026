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

/** Playful lines shown under the bar while a selfie is read, one every few seconds, in a random order. */
export const FUN_LINES = [
  'Analisando sua face…',
  'Rompendo as barreiras da maquiagem…',
  'Vendo se você é você mesmo…',
  'Procurando seu melhor ângulo…',
  'Conferindo se não é seu primo…',
  'Comparando com a foto do RG de 2009…',
  'Calibrando o detector de charme…',
  'O medidor de beleza estourou, recalibrando…',
  'Separando você do seu gêmeo do mal…',
  'Ignorando a olheira, prometo…',
  'Tirando o brilho da testa…',
  'Pedindo licença pro filtro do Instagram…',
  'Decorando seu rosto pra te achar na pista…',
  'Contando quantos sorrisos cabem aqui…',
  'Avisando as câmeras que você chegou…',
  'Checando se o look tá à altura da festa…',
]

const FUN_EVERY_MS = 2800

/** The lines in a fresh random order, so each selfie gets its own sequence. */
export function shuffledFunLines(random = Math.random) {
  const lines = [...FUN_LINES]
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[lines[i], lines[j]] = [lines[j], lines[i]]
  }
  return lines
}

/** The line to show at `now`, moving to the next one every few seconds and starting over at the end. */
export function funLineAt(lines: string[], since: number, now: number) {
  return lines[Math.floor(Math.max(0, now - since) / FUN_EVERY_MS) % lines.length]
}
