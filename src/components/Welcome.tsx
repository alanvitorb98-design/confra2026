import { SelfieIcon } from './Icons'
import { useEffect, useRef, useState } from 'react'
import { checkCode, JoinError, peekInvite, rememberEntry, type InviteInfo } from '../lib/backend'
import type { Guest } from '../lib/types'
import { Logo } from './Logo'
import { PartyScene } from '../brand/PartyScene'
import { SelfieCam } from './SelfieCam'
import { BRAND } from '../brand/brand'

type NewGuest = Omit<Guest, 'id'>

interface Props {
  /** the event code from the printed QR or the telão (?c=) */
  code: string
  /** the personal invitation from the link (?i=) */
  invite: string
  /** the organizer let only invited guests sign up */
  inviteOnly: boolean
  /** a código de volta from the QR the organizer showed (?v=): used right away */
  autoBack?: string
  onEnter: (code: string, g: NewGuest, sameName: boolean) => Promise<void>
  onBack: (code: string) => Promise<void>
  /** back into the account of a name picked on the invitation */
  onAs: (invite: string, guestId: string) => Promise<void>
  /** back to the opening screen (date, place, map), while the party has not started */
  onStart?: () => void
}

const NO_NET = 'Não deu pra entrar agora. Confere a internet e tenta de novo.'
const BUSY = 'Muitas tentativas. Espera um pouco e tenta de novo.'

export function Welcome({ code: linkCode, invite: linkInvite, inviteOnly, autoBack, onEnter, onBack, onAs, onStart }: Props) {
  const [back, setBack] = useState(!!autoBack)
  const [code, setCode] = useState(linkCode)
  const [invite, setInvite] = useState(linkInvite)
  // undefined while asking the server; null when the invitation is wrong or was cancelled
  const [info, setInfo] = useState<InviteInfo | null>()
  const [codeOk, setCodeOk] = useState<boolean>()
  // picked "Sou outra pessoa" on the invitation's list of names
  const [newPerson, setNewPerson] = useState(false)
  // the server said no to the sign-up: the door shows why
  const [refused, setRefused] = useState<'code' | 'full'>()
  const [name, setName] = useState('')
  const [instagram, setInstagram] = useState('')
  const [faceOptIn, setFaceOptIn] = useState(true)
  const [selfieUrl, setSelfieUrl] = useState<string>()
  const [cam, setCam] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  // someone with this name is already in: asks whether it is this person
  const [sameName, setSameName] = useState(false)

  useEffect(() => {
    if (!invite) return setInfo(null)
    let alive = true
    setInfo(undefined)
    peekInvite(invite)
      .then((i) => alive && setInfo(i))
      .catch(() => alive && setInfo(null))
    return () => {
      alive = false
    }
  }, [invite])

  const freeSeat = !!info && info.people.length < info.seats
  // with the door closed, an event code from an old QR is checked before the guest fills in the form
  useEffect(() => {
    if (!inviteOnly || !code || freeSeat) return
    let alive = true
    checkCode(code)
      .then((ok) => alive && setCodeOk(ok))
      .catch(() => alive && setCodeOk(true)) // no signal: the sign-up itself checks it again
    return () => {
      alive = false
    }
  }, [inviteOnly, code, freeSeat])

  const pickSelfie = (f?: File) => {
    if (!f) return
    if (selfieUrl) URL.revokeObjectURL(selfieUrl)
    setSelfieUrl(URL.createObjectURL(f))
    setCam(false)
  }

  const ready = name.trim().length > 1 && (!faceOptIn || selfieUrl)

  const submit = async (otherPerson: boolean) => {
    if (!ready || busy) return
    setBusy(true)
    setError(undefined)
    setSameName(false)
    try {
      await onEnter(code.trim(), { name: name.trim(), instagram: instagram.replace(/^@/, '').trim() || undefined, faceOptIn, selfieUrl: faceOptIn ? selfieUrl : undefined }, otherPerson)
    } catch (err) {
      const reason = err instanceof JoinError ? err.reason : 'other'
      if (reason === 'name') setSameName(true)
      else if (reason === 'code' || reason === 'full') setRefused(reason)
      else setError(reason === 'busy' ? BUSY : NO_NET)
      setBusy(false)
    }
  }

  const askingInvite = !!invite && info === undefined
  const askingCode = inviteOnly && !!code && !freeSeat && codeOk === undefined
  const closed = refused || (inviteOnly && !freeSeat && !(code && codeOk))
  const view = back
    ? 'back'
    : askingInvite || (askingCode && !refused)
      ? 'loading'
      : info && info.people.length > 0 && !newPerson
        ? 'who'
        : closed
          ? 'door'
          : 'form'

  return (
    <div className="welcome">
      <PartyScene variant="ambient" />
      <div className="logo-block">
        <Logo />
        <p className="logo-sub">{BRAND.welcomeSub}</p>
      </div>

      {view === 'back' && <ComeBack initial={autoBack} onBack={onBack} onCancel={() => setBack(false)} />}

      {view === 'loading' && <p className="door-wait" role="status">Abrindo seu convite…</p>}

      {view === 'who' && info && (
        <WhoAreYou info={info} canAdd={freeSeat || !inviteOnly} onPick={(id) => onAs(invite, id)} onOther={() => setNewPerson(true)} onBack={() => setBack(true)} />
      )}

      {view === 'door' && (
        <Door
          why={
            refused === 'full' || (info && !freeSeat)
              ? 'full'
              : invite && info === null
                ? 'invite'
                : code && (codeOk === false || refused === 'code')
                  ? 'old'
                  : 'none'
          }
          onInvite={(t) => {
            rememberEntry('invite', t)
            setRefused(undefined)
            setNewPerson(false)
            setInvite(t)
          }}
          onCode={(c) => {
            rememberEntry('code', c)
            setRefused(undefined)
            setCodeOk(true)
            setCode(c)
          }}
          onBack={() => setBack(true)}
          onStart={onStart}
        />
      )}

      {view === 'form' && (
      <form
        className="welcome-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit(false)
        }}
      >
        {info && freeSeat && <p className="invite-name">Convite: <b>{info.label}</b></p>}
        <label className="field">
          <span>Seu nome</span>
          <input id="name" value={name} onChange={(e) => { setName(e.target.value); setSameName(false) }} placeholder={BRAND.namePlaceholder} autoComplete="given-name" />
        </label>
        <label className="field">
          <span>Instagram <em>opcional</em></span>
          <input id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@seu.perfil" autoCapitalize="none" />
        </label>

        <div className="consent">
          <b>Bora brincar de paparazzi?</b>
          <p>Pra valer as missões e o ranking de quem mais aparece, a gente reconhece seu rosto nas fotos. Seu rosto só é usado {BRAND.faceScope} e é apagado depois da festa.</p>
          <div className="consent-choice">
            <button type="button" className={`chip${faceOptIn ? ' on' : ''}`} onClick={() => setFaceOptIn(true)}>Topo!</button>
            <button type="button" className={`chip${!faceOptIn ? ' on' : ''}`} onClick={() => setFaceOptIn(false)}>Prefiro marcar na mão</button>
          </div>
          {faceOptIn && (
            <button type="button" className="selfie" onClick={() => setCam(true)}>
              {selfieUrl ? <img src={selfieUrl} alt="Sua selfie" /> : <span className="selfie-empty"><SelfieIcon /></span>}
              <span>{selfieUrl ? 'Trocar selfie' : 'Tirar minha selfie'}</span>
            </button>
          )}
        </div>

        {sameName ? (
          <div className="same-name" role="alert">
            <p>Já tem alguém chamado <b>{name.trim()}</b> na festa. É você, em outro celular ou navegador?</p>
            <button type="button" className="btn primary wide" onClick={() => setBack(true)}>Sou eu, quero voltar pra minha conta</button>
            <button type="button" className="btn ghost wide" onClick={() => submit(true)} disabled={busy}>Não, sou outra pessoa</button>
          </div>
        ) : (
          <>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn primary wide" disabled={!ready || busy}>{busy ? 'Entrando…' : 'Entrar na festa'}</button>
          </>
        )}
        <button type="button" className="install-skip back-link" onClick={() => setBack(true)}>Já me cadastrei em outro celular</button>
        {onStart && <button type="button" className="install-skip back-link" onClick={onStart}>Voltar pro início (data e local)</button>}
      </form>
      )}
      {cam && <SelfieCam onShot={pickSelfie} onClose={() => setCam(false)} />}
    </div>
  )
}

/** A personal invitation opened again: whoever already came in with it picks their name and is back in. */
function WhoAreYou({ info, canAdd, onPick, onOther, onBack }: { info: InviteInfo; canAdd: boolean; onPick: (id: string) => Promise<void>; onOther: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  return (
    <div className="welcome-form">
      <p className="invite-name">Convite: <b>{info.label}</b></p>
      <p className="back-help">Quem é você? Toque no seu nome pra continuar com as mesmas fotos e pontos.</p>
      <div className="who-list">
        {info.people.map((p) => (
          <button
            key={p.id}
            className="btn ghost wide"
            disabled={!!busy}
            onClick={async () => {
              setBusy(p.id)
              setError(undefined)
              try {
                await onPick(p.id)
              } catch (err) {
                setError(err instanceof JoinError && err.reason === 'busy' ? BUSY : NO_NET)
                setBusy(undefined)
              }
            }}
          >
            {busy === p.id ? 'Entrando…' : p.name}
          </button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {canAdd ? (
        <button className="btn primary wide" onClick={onOther} disabled={!!busy}>Sou outra pessoa</button>
      ) : (
        <>
          <p className="back-help">Os {info.seats} lugares desse convite já foram usados. Se você não está na lista, entre pelo QR da festa.</p>
          <button className="btn primary wide" onClick={onOther} disabled={!!busy}>Tenho o QR ou o código da festa</button>
        </>
      )}
      <button type="button" className="install-skip back-link" onClick={onBack}>Tenho um código de volta</button>
    </div>
  )
}

const DOOR_WHY = {
  none: 'A entrada é só pra convidados. Abra o link do seu convite ou escaneie o QR da festa. Se tiver o código, digite aqui.',
  invite: 'Esse convite não vale mais. Peça um novo pra quem te convidou, ou entre pelo QR da festa.',
  full: 'Os lugares desse convite já foram usados. Entre pelo QR da festa ou peça outro convite.',
  old: 'Esse QR é antigo. Escaneie o QR da festa de novo ou digite o código novo.',
}

/** Only invited guests sign up: a code or the invitation link, typed or pasted, opens the door. */
function Door({ why, onInvite, onCode, onBack, onStart }: { why: keyof typeof DOOR_WHY; onInvite: (token: string) => void; onCode: (code: string) => void; onBack: () => void; onStart?: () => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  return (
    <form
      className="welcome-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy) return
        // a whole link pasted: its invitation or code
        let raw = value.trim()
        try {
          const q = new URL(raw).searchParams
          raw = q.get('i') ?? q.get('c') ?? raw
        } catch {
          /* not a link: the code itself */
        }
        const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (clean.length < 6) return setError('Digite o código inteiro.')
        setBusy(true)
        setError(undefined)
        try {
          if (clean.length === 10 && (await peekInvite(clean))) return onInvite(clean)
          if (await checkCode(clean)) return onCode(clean)
          setError('Esse código não confere. Confere com quem te convidou.')
        } catch (err) {
          setError(err instanceof JoinError && err.reason === 'busy' ? BUSY : NO_NET)
        }
        setBusy(false)
      }}
    >
      <p className="back-help">{DOOR_WHY[why]}</p>
      <label className="field">
        <span>Código ou link do convite</span>
        <input className="door-code" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Código do convite" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn primary wide" disabled={!value.trim() || busy}>{busy ? 'Conferindo…' : 'Continuar'}</button>
      <button type="button" className="install-skip back-link" onClick={onBack}>Já me cadastrei em outro celular</button>
      {onStart && <button type="button" className="install-skip back-link" onClick={onStart}>Voltar pro início (data e local)</button>}
    </form>
  )
}

/** Back into the same account with the código de volta shown in "Eu", or in the organizer's QR. */
function ComeBack({ initial, onBack, onCancel }: { initial?: string; onBack: (code: string) => Promise<void>; onCancel: () => void }) {
  const [value, setValue] = useState(initial ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const form = useRef<HTMLFormElement>(null)
  // the organizer's QR brings the code: in straight away
  useEffect(() => {
    if (initial) form.current?.requestSubmit()
  }, [initial])
  return (
    <form
      ref={form}
      className="welcome-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (clean.length !== 6 || busy) return
        setBusy(true)
        setError(undefined)
        try {
          await onBack(clean)
        } catch (err) {
          const reason = err instanceof JoinError ? err.reason : 'other'
          setError(
            reason === 'back'
              ? 'Esse código não confere. Ele fica na aba Eu do celular onde você se cadastrou.'
              : reason === 'busy'
                ? BUSY
                : NO_NET,
          )
          setBusy(false)
        }
      }}
    >
      <p className="back-help">Digita o código de volta que aparece na aba <b>Eu</b> do celular onde você se cadastrou. Assim você continua com as mesmas fotos e pontos, sem criar outra conta.</p>
      <label className="field">
        <span>Código de volta</span>
        <input className="back-code" value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} placeholder="XXXXXX" maxLength={8} autoCapitalize="characters" autoComplete="one-time-code" autoCorrect="off" spellCheck={false} />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn primary wide" disabled={clean.length !== 6 || busy}>{busy ? 'Entrando…' : 'Voltar pra minha conta'}</button>
      <p className="back-help small">Não sabe o código? Peça pra organização mostrar o seu QR de volta.</p>
      <button type="button" className="install-skip back-link" onClick={onCancel}>Primeira vez aqui</button>
    </form>
  )
}
