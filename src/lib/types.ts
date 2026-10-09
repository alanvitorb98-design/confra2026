export type Reaction = '🔥' | '😂' | '😍' | '🕺'

export const REACTIONS: Reaction[] = ['🔥', '😂', '😍', '🕺']

export type Frame = 'dark' | 'chrome' | 'neon'

export const FRAMES: { id: Frame; label: string }[] = [
  { id: 'dark', label: 'Preta' },
  { id: 'chrome', label: 'Cromada' },
  { id: 'neon', label: 'Neon' },
]

export interface Guest {
  name: string
  instagram?: string
  /** Object URL of the selfie, when the guest opted in to face matching */
  selfieUrl?: string
  faceOptIn: boolean
}

export interface Photo {
  id: string
  author: string
  caption: string
  /** Full-quality original, shown in the viewer and used for the final album */
  url?: string
  /** The untouched camera file, for downloads */
  file?: File
  /** CSS background used by the example photos until the backend exists */
  placeholder?: string
  takenAt: Date
  reactions: Record<Reaction, number>
  mine: Partial<Record<Reaction, boolean>>
  tilt: number
  frame: Frame
}

export interface Mission {
  id: string
  title: string
  points: number
  done: boolean
}

export interface RankEntry {
  name: string
  value: number
}
