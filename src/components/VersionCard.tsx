import { useEffect, useState } from 'react'
import { APP_VERSION, latestVersion, updateNow } from '../lib/update'

/** Shows the running version and gets the newest one on demand. */
export function VersionCard() {
  const [latest, setLatest] = useState<string | null>()
  const [busy, setBusy] = useState(false)

  const check = async () => {
    setBusy(true)
    setLatest(await latestVersion())
    setBusy(false)
  }

  useEffect(() => {
    check()
  }, [])

  const behind = latest && latest !== APP_VERSION
  return (
    <div className="version">
      <span>
        Versão {APP_VERSION}
        {latest === null ? ' · sem conexão' : behind ? ' · tem versão nova!' : latest ? ' · atualizada' : ''}
      </span>
      <button className={`btn ${behind ? 'primary' : 'ghost'} small`} disabled={busy} onClick={() => (behind ? updateNow() : check())}>
        {busy ? 'Verificando…' : behind ? 'Atualizar agora' : 'Verificar versão'}
      </button>
    </div>
  )
}
