import type { ReactNode } from 'react'
import { frameClass } from '../lib/frame'
import type { Frame } from '../lib/types'

export function PolaroidFrame({ frame, className = '', children }: { frame: Frame; className?: string; children: ReactNode }) {
  return <figure className={`${frameClass(frame)} ${className}`}>{children}</figure>
}
