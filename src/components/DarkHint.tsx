import { useState } from 'react'

const KEY = 'confra.darkhint'

// Samsung Internet's dark mode repaints every site dark and ignores color-scheme, so the app can't opt out.
// When it is likely on, tell the guest how to get the invite colors back.
const forcedDark = () =>
  /SamsungBrowser/i.test(navigator.userAgent) && window.matchMedia?.('(prefers-color-scheme: dark)').matches

function seen() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function DarkHint() {
  const [show, setShow] = useState(() => forcedDark() && !seen())
  if (!show) return null
  const close = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* fine, shows again next time */
    }
    setShow(false)
  }
  return (
    <div className="dark-hint" role="note">
      <p>
        <strong>Tá tudo escuro?</strong> É o modo escuro do Samsung Internet. Abra o navegador, toque em ☰ e desligue o
        <em> Modo escuro</em> pra ver o app nas cores da festa.
      </p>
      <button className="btn ghost small" onClick={close}>Entendi</button>
    </div>
  )
}
