import { describe, expect, it } from 'vitest'
import { progressOf } from '../faceProgress'

const pending = { status: 'pending' as const, reading: false, worker: false, ahead: 0 }

describe('selfie progress bar', () => {
  it('starts low while the selfie is uploading and never passes 18%', () => {
    expect(progressOf(true, undefined, 0, 0)?.pct).toBe(4)
    expect(progressOf(true, undefined, 0, 60_000)?.pct).toBe(18)
  })

  it('climbs while the server starts, but stays below the reading step', () => {
    const early = progressOf(false, pending, 0, 5_000)!.pct
    const late = progressOf(false, pending, 0, 120_000)!.pct
    expect(early).toBeGreaterThan(20)
    expect(late).toBeGreaterThan(early)
    expect(late).toBeLessThan(80)
  })

  it('shows the line when the server is on and others are ahead', () => {
    expect(progressOf(false, { ...pending, worker: true, ahead: 1 }, 0, 0)?.label).toBe('1 selfie na sua frente…')
    expect(progressOf(false, { ...pending, worker: true, ahead: 3 }, 0, 0)?.label).toBe('3 selfies na sua frente…')
  })

  it('jumps to reading once the server took this selfie', () => {
    expect(progressOf(false, { ...pending, worker: true, reading: true }, 0, 0)?.pct).toBe(92)
  })

  it('hides the bar when the analysis is over', () => {
    expect(progressOf(false, { ...pending, status: 'ready' }, 0, 0)).toBeNull()
    expect(progressOf(false, { ...pending, status: 'failed' }, 0, 0)).toBeNull()
  })
})
