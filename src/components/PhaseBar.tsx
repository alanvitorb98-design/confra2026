import { EVENT, LOOK_CLOSES, LOOK_OPENS, clock, lookOpen, setTestClock, until, type Phase } from '../lib/event'

/** One line under the top bar saying what is open now and what comes next. */
export function PhaseBar({ phase, now, test }: { phase: Phase; now: number; test: boolean }) {
  const text =
    phase === 'countdown'
      ? 'Modo organização · os convidados ainda veem a contagem'
      : phase === 'warmup'
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
      {test && (
        <button
          className="phasebar-test"
          title="Voltar pra hora real"
          onClick={() => confirm('Sair do relógio de teste e voltar pra hora real?') && (setTestClock(null), location.reload())}
        >
          teste ×
        </button>
      )}
    </div>
  )
}
