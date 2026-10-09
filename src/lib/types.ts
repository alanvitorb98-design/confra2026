export type Reaction = '🔥' | '😂' | '😍' | '🥂'

export const REACTIONS: Reaction[] = ['🔥', '😂', '😍', '🥂']

export type Frame = 'classic' | 'gold' | 'dark'

export const FRAMES: { id: Frame; label: string }[] = [
  { id: 'classic', label: 'Clássica' },
  { id: 'gold', label: 'Dourada' },
  { id: 'dark', label: 'Preta' },
]

export interface Guest {
  /** Assigned by the server when the guest joins */
  id: string
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
  authorId?: string
  caption: string
  /** Full-quality original, shown in the viewer and used for the final album */
  url?: string
  /** Light copy (about 1080px wide) used on screen while animating */
  preview?: string
  /** The untouched camera file, for downloads */
  file?: File
  /** Size of the original, for the download button */
  bytes?: number
  /** Only on photos sent from this phone that have not reached the server yet */
  status?: 'sending' | 'failed'
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
