import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { admin, type AdminInvite, type FoundGuest } from '../lib/backend'
import { BRAND } from '../brand/brand'

const APP_URL = `${location.origin}${import.meta.env.BASE_URL}`
const inviteLink = (token: string) => `${APP_URL}?i=${token}`

const copy = (text: string) => navigator.clipboard.writeText(text)

/** Personal invitations: one link per guest or family, each with its seats and who already came in. */
export function InvitesAdmin({ run, busy }: { run: <T>(job: () => Promise<T>, ok: string | ((r: T) => string)) => Promise<void>; busy: boolean }) {
  const [list, setList] = useState<AdminInvite[]>()
  const [lines, setLines] = useState('')
  const [filter, setFilter] = useState('')

  const reload = () => admin.invites().then(setList, () => undefined)
  useEffect(() => {
    reload()
  }, [])

  const shown = (list ?? []).filter((i) => !filter.trim() || `${i.label} ${i.people.join(' ')}`.toLowerCase().includes(filter.trim().toLowerCase()))
  const seats = (list ?? []).filter((i) => !i.revoked).reduce((n, i) => n + i.seats, 0)
  const used = (list ?? []).filter((i) => !i.revoked).reduce((n, i) => n + i.people.length, 0)

  return (
    <section className="panel admin-section">
      <h3>Convites pessoais</h3>
      <p className="page-note">
        Um link pra cada convidado ou família. Quem abre o link de novo, em qualquer celular, toca no próprio nome e volta pra mesma conta.
        Um por linha; pra família, o número de pessoas depois de ponto e vírgula: <b>Família Souza; 4</b>. Dá pra colar direto de uma planilha.
      </p>
      <textarea className="admin-input-big" value={lines} onChange={(e) => setLines(e.target.value)} placeholder={'Tia Lu\nFamília Souza; 4'} aria-label="Convites, um por linha" />
      <button
        className="btn primary small"
        disabled={busy || !lines.trim()}
        onClick={() =>
          run(async () => {
            const n = await admin.addInvites(lines)
            setLines('')
            await reload()
            return n
          }, (n) => (n === 1 ? '1 convite criado.' : `${n} convites criados.`))
        }
      >
        Criar convites
      </button>

      {list && list.length > 0 && (
        <>
          <p className="page-note">{list.length} convites · {used} de {seats} lugares usados</p>
          <div className="admin-row">
            <button
              className="btn ghost small"
              onClick={() => run(() => copy(list.filter((i) => !i.revoked).map((i) => `${i.label}\t${i.seats}\t${inviteLink(i.token)}`).join('\n')), 'Lista copiada. Cola numa planilha.')}
            >
              Copiar todos (planilha)
            </button>
          </div>
          {list.length > 8 && (
            <label className="field">
              <span>Procurar</span>
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Nome ou família" />
            </label>
          )}
          <ul className="invite-list">
            {shown.map((i) => (
              <li key={i.id} className={`invite-item${i.revoked ? ' off' : ''}`}>
                <b>{i.label}</b>
                <small>
                  {i.revoked ? 'Cancelado · ' : ''}
                  {i.people.length}/{i.seats} {i.seats === 1 ? 'lugar' : 'lugares'}
                  {i.people.length > 0 && ` · ${i.people.join(', ')}`}
                </small>
                <div className="admin-row">
                  {!i.revoked && (
                    <>
                      <button className="btn ghost small" onClick={() => run(() => copy(inviteLink(i.token)), 'Link copiado.')}>Copiar link</button>
                      <a
                        className="btn ghost small"
                        href={`https://wa.me/?text=${encodeURIComponent(`${BRAND.inviteMessage}\n${inviteLink(i.token)}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                    </>
                  )}
                  <button
                    className="btn ghost small"
                    disabled={busy}
                    onClick={() => run(async () => {
                      await admin.setInvite(i.id, { revoked: !i.revoked })
                      await reload()
                    }, i.revoked ? 'Convite reativado.' : 'Convite cancelado. Quem já entrou continua.')}
                  >
                    {i.revoked ? 'Reativar' : 'Cancelar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** A guest who lost their account (new phone, cleared browser, forgot the código de volta): the organizer finds
 * them and shows their QR de volta, face to face. */
export function ReturnHelp() {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<FoundGuest[]>()
  const [picked, setPicked] = useState<{ guest: FoundGuest; code: string; qr: string }>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (q.trim().length < 2) return setFound(undefined)
    let alive = true
    const t = window.setTimeout(() => admin.findGuests(q).then((r) => alive && setFound(r), () => alive && setError('Não consegui procurar agora.')), 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])

  const show = async (guest: FoundGuest) => {
    setError(undefined)
    try {
      const code = await admin.returnCode(guest.id)
      const qr = await QRCode.toDataURL(`${APP_URL}?v=${code}`, { width: 520, margin: 2, errorCorrectionLevel: 'M', color: { dark: BRAND.colors.ink, light: '#fffdf7' } })
      setPicked({ guest, code, qr })
    } catch {
      setError('Não consegui pegar o código agora.')
    }
  }

  return (
    <section className="panel admin-section">
      <h3>Trazer alguém de volta</h3>
      <p className="page-note">Pra quem trocou de celular ou esqueceu o código de volta. Procure a pessoa, confira que é ela e mostre o QR: ela escaneia e volta pra conta dela, com as mesmas fotos e pontos.</p>
      {picked ? (
        <div className="return-qr">
          <b>{picked.guest.name}</b>
          <img src={picked.qr} alt={`QR de volta de ${picked.guest.name}`} />
          <code>{picked.code}</code>
          <button className="btn ghost small" onClick={() => setPicked(undefined)}>Fechar</button>
        </div>
      ) : (
        <>
          <label className="field">
            <span>Nome ou Instagram</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Quem perdeu a conta" />
          </label>
          {found && found.length === 0 && <p className="page-note">Ninguém com esse nome.</p>}
          {found && found.length > 0 && (
            <ul className="invite-list">
              {found.map((g) => (
                <li key={g.id} className="invite-item">
                  <b>{g.name}</b>
                  <small>
                    {[g.instagram && `@${g.instagram}`, g.invite && `convite ${g.invite}`, `${g.photos} ${g.photos === 1 ? 'foto' : 'fotos'}`, `entrou ${new Date(g.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`].filter(Boolean).join(' · ')}
                  </small>
                  <div className="admin-row">
                    <button className="btn primary small" onClick={() => show(g)}>Mostrar QR de volta</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  )
}
