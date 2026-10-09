import { EVENT, LOOK_CLOSES, LOOK_OPENS, clock, lookOpen, until, type Phase } from '../lib/event'

/** One line under the top bar saying what is open now and what comes next. */
export function PhaseBar({ phase, now, test }: { phase: Phase; now: number; test: boolean }) {
  const text =
    phase === 'warmup'
      ? `Looks abrem às ${clock(LOOK_OPENS)} · em ${until(LOOK_OPENS.getTime() - now)}`
      : phase === 'look'
        ? `Looks até ${clock(LOOK_CLOSES)} · festa em ${until(EVENT.start.getTime() - now)}`
        : phase === 'party'
          ? lookOpen(now)
            ? `A festa começou! Looks ainda abertos até ${clock(LOOK_CLOSES)}`
            : 'A festa começou! Câmera e missões liberadas'
          : 'Valeu, galera! As fotos ficam aqui pra baixar'
  return (
    <div className={`phasebar phase-${phase}`} role="status">
      <span className="phasebar-dot" aria-hidden />
      <span>{text}</span>
      {test && <span className="phasebar-test">teste</span>}
    </div>
  )
}
