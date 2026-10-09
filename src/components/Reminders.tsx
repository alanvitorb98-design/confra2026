import { useEffect, useState } from 'react'
import { eventCode } from '../lib/backend'
import { disablePush, enablePush, pushState, testPush, type PushState } from '../lib/push'

/** "Me avisa todo dia": one notification a day until the party (sent by the server). */
export function Reminders() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    pushState().then(setState).catch(() => setState('unsupported'))
  }, [])

  const run = async (job: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    setNote('')
    try {
      await job()
      if (done) setNote(done)
    } catch (e) {
      setNote(e instanceof Error ? `Ops, ${e.message}.` : 'Ops, tenta de novo.')
    } finally {
      setBusy(false)
    }
  }

  if (!state || state === 'unsupported') return null
  return (
    <div className="cd-remind">
      {state === 'install' && <p>Pra receber os avisos no iPhone, abra o app pelo ícone da tela de início.</p>}
      {state === 'denied' && <p>Os avisos estão bloqueados pra este app. Dá pra liberar nas configurações de notificação do celular.</p>}
      {state === 'off' && (
        <>
          <button className="btn primary wide" disabled={busy} onClick={() => run(async () => setState(await enablePush(eventCode())))}>
            Me avisa todo dia
          </button>
          <p>Um lembrete por dia até a festa, e outro quando o app abrir.</p>
        </>
      )}
      {state === 'on' && (
        <>
          <p className="cd-remind-on">Avisos ligados. Todo dia às 9h chega a contagem.</p>
          <div className="cd-actions">
            <button className="btn ghost small" disabled={busy} onClick={() => run(testPush, 'Mandei um aviso de teste.')}>
              Testar agora
            </button>
            <button className="btn ghost small" disabled={busy} onClick={() => run(async () => { await disablePush(); setState('off') })}>
              Desligar
            </button>
          </div>
        </>
      )}
      {note && <p role="status">{note}</p>}
    </div>
  )
}
