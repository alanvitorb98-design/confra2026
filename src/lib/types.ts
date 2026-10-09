export type Reaction = '🔥' | '😂' | '😍' | '🥂'

export const REACTIONS: Reaction[] = ['🔥', '😂', '😍', '🥂']

export type Frame = 'classic' | 'gold' | 'dark'

export const FRAMES: { id: Frame; label: string }[] = [
  { id: 'classic', label: 'Clássica' },
  { id: 'gold', label: 'Dourada' },
  { id: 'dark', label: 'Preta' },
]

export interface Guest {
  name: string
  instagram?: string
  /** Object URL of the selfie, when the guest opted in to face matching */
  selfieUrl?: string
  faceOptIn: boolean
}

/** party: photos during the party; look: the outfit wall, open only in the hours before it */
export type Wall = 'party' | 'look'

export interface Photo {
  id: string
  kind: Wall
  author: string
  caption: string
  /** Full-quality original, shown in the viewer and used for the final album */
  url?: string
  /** Light copy (about 1080px wide) used on screen while animating */
  preview?: string
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
