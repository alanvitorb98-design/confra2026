import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { APP_OPENS, EVENT, calendarFile, clock, day, split, useNow } from '../lib/event'
import { Logo } from './Logo'
import { PartyScene } from './PartyScene'

function Unit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, '0')
  return (
    <div className="cd-unit">
      <span className="cd-num">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={text}
            initial={{ y: '-60%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '60%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="cd-label">{label}</span>
    </div>
  )
}

function saveCalendar() {
  const url = URL.createObjectURL(calendarFile())
  const a = document.createElement('a')
  a.href = url
  a.download = 'confra-da-firma.ics'
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Before the app opens: countdown to the party, with the place behind a button. */
export function Countdown() {
  const t = useNow(true)
  const left = split(EVENT.start.getTime() - t)
  const [place, setPlace] = useState(false)

  return (
    <div className="countdown">
      <PartyScene variant="ambient" />
      <div className="logo-block">
        <Logo />
        <p className="logo-sub">Equipe Derhu</p>
      </div>

      <div className="cd-card">
        <p className="cd-title">Faltam</p>
        <div className="cd-units" role="timer" aria-label={`Faltam ${left.d} dias, ${left.h} horas e ${left.m} minutos`}>
          <Unit value={left.d} label={left.d === 1 ? 'dia' : 'dias'} />
          <Unit value={left.h} label="horas" />
          <Unit value={left.m} label="min" />
          <Unit value={left.s} label="seg" />
        </div>
        <p className="cd-when">{day(EVENT.start)} às {clock(EVENT.start)}</p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {place ? (
          <motion.div
            key="place"
            className="cd-place"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <b>{EVENT.place}</b>
            {EVENT.address && <p>{EVENT.address}</p>}
            <div className="cd-actions">
              <a className="btn primary small" href={EVENT.mapsUrl} target="_blank" rel="noreferrer">Abrir no mapa</a>
              <button className="btn ghost small" onClick={saveCalendar}>Salvar na agenda</button>
            </div>
          </motion.div>
        ) : (
          <motion.button key="reveal" className="btn primary wide" onClick={() => setPlace(true)} exit={{ opacity: 0, scale: 0.96 }} whileTap={{ scale: 0.96 }}>
            Ver o local
          </motion.button>
        )}
      </AnimatePresence>

      <p className="cd-note">O app abre no dia {day(APP_OPENS)} às {clock(APP_OPENS)} pra você fazer seu cadastro.</p>
    </div>
  )
}
