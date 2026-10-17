import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { admin, PEOPLE_POINTS, r2Setup, r2Status, type AdminEvent, type MissionRow } from '../lib/backend'
import { testClock, testMoments } from '../lib/event'
import { PlaceMap } from './PlaceMap'
import { BRAND } from '../brand/brand'

const APP_URL = `${location.origin}${import.meta.env.BASE_URL}`

// <input type="datetime-local"> speaks local wall time; the party runs on Brasília time.
const toLocal = (iso: string) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
const fromLocal = (v: string) => new Date(`${v}:00-03:00`).toISOString()

const TIMES: { key: keyof AdminEvent; label: string }[] = [
  { key: 'app_opens', label: 'App abre (cadastro)' },
  { key: 'look_opens', label: `${BRAND.lookName} abre` },
  { key: 'look_closes', label: `${BRAND.lookName} fecha` },
  { key: 'party_starts', label: 'Festa começa' },
  { key: 'party_ends', label: 'Festa termina' },
]

const mb = (b: number) => (b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })

interface Props {
  missions: MissionRow[]
  onClose: () => void
  onTelao: () => void
}

/** Organizer-only settings. The database checks the organizer flag again on every call. */
export function AdminPanel({ missions, onClose, onTelao }: Props) {
  const [ev, setEv] = useState<AdminEvent>()
  const [qr, setQr] = useState<string>()
  const [stats, setStats] = useState<{ guests: number; photos: number; bytes: number }>()
  const [msg, setMsg] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Record<string, { title: string; points: number; active: boolean; target: string }>>({})
  const [adding, setAdding] = useState({ title: '', points: 15, target: '' })
  const [faceStats, setFaceStats] = useState<{ has_secret: boolean; worker_seen: string | null; selfies: number; pending: number }>()
  const [faceSecret, setFaceSecret] = useState<string>()
  const [r2, setR2] = useState<boolean>()

  const link = APP_URL

  useEffect(() => {
    admin.event().then(setEv).catch(() => setMsg('Não consegui carregar as configurações.'))
    admin.stats().then(setStats).catch(() => undefined)
    admin.faceStats().then(setFaceStats).catch(() => undefined)
    r2Status().then(setR2)
  }, [])

  useEffect(() => {
    if (!link) return
    QRCode.toDataURL(link, { width: 720, margin: 2, errorCorrectionLevel: 'M', color: { dark: BRAND.colors.ink, light: '#fffdf7' } }).then(setQr)
  }, [link])

  const run = async <T,>(job: () => Promise<T>, ok: string | ((result: T) => string)) => {
    setBusy(true)
    setMsg(undefined)
    try {
      const result = await job()
      setMsg(typeof ok === 'string' ? ok : ok(result))
    } catch {
      setMsg('Não deu certo. Confere os campos e tenta de novo.')
    } finally {
      setBusy(false)
    }
  }

  const set = <K extends keyof AdminEvent>(k: K, v: AdminEvent[K]) => setEv((e) => (e ? { ...e, [k]: v } : e))

  const findOnMap = () =>
    ev &&
    run(async () => {
      const q = [ev.place, ev.address].filter(Boolean).join(', ')
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`)
      const [hit] = (await res.json()) as { lat: string; lon: string }[]
      if (!hit) throw new Error('não achei')
      setEv({ ...ev, lat: Number(hit.lat), lng: Number(hit.lon) })
    }, 'Achei no mapa. Confere o pino e salva.')

  const downloadQr = () => {
    if (!qr) return
    const a = document.createElement('a')
    a.href = qr
    a.download = BRAND.qrFile
    a.click()
  }

  const row = (m: MissionRow) => draft[m.id] ?? { title: m.title, points: m.points, active: m.active, target: m.target ?? '' }

  return (
    <div className="page admin">
      <div className="admin-head">
        <h2 className="page-title">Painel</h2>
        <button className="btn ghost small" onClick={onClose}>Voltar</button>
      </div>
      {msg && <p className="admin-msg" role="status">{msg}</p>}

      {stats && (
        <dl className="stats">
          <div><dt>Convidados</dt><dd>{stats.guests}</dd></div>
          <div><dt>Fotos</dt><dd>{stats.photos}</dd></div>
          <div><dt>Espaço</dt><dd>{mb(stats.bytes)}<small> / 1024 MB</small></dd></div>
        </dl>
      )}

      <section className="panel admin-section">
        <h3>Telão</h3>
        <p className="page-note">Abre num notebook ligado no projetor ou na TV. Passa as últimas fotos sozinho e mostra cada foto nova assim que chega, com o QR pra quem quiser entrar. Esc ou dois toques saem.</p>
        <button className="btn primary small" onClick={onTelao}>Abrir telão</button>
      </section>

      <section className="panel admin-section">
        <h3>Convite</h3>
        <p className="page-note">Qualquer pessoa com o link ou o QR entra, sem código. Imprime no convite ou manda no grupo.</p>
        {qr && <img className="admin-qr" src={qr} alt={`QR code para ${link}`} />}
        <div className="admin-row">
          <button className="btn primary small" onClick={downloadQr} disabled={!qr}>Baixar QR</button>
          <button className="btn ghost small" onClick={() => run(() => navigator.clipboard.writeText(link), 'Link copiado.')} disabled={!link}>Copiar link</button>
        </div>
      </section>

      {ev && (
        <section className="panel admin-section">
          <h3>Horários <small>(Brasília)</small></h3>
          <p className="page-note">Mudar um horário muda o app de todo mundo. Pra só ver uma fase, use Testes lá embaixo.</p>
          {TIMES.map((t) => (
            <label key={t.key} className="field">
              <span>{t.label}</span>
              <input type="datetime-local" value={toLocal(ev[t.key] as string)} onChange={(e) => e.target.value && set(t.key, fromLocal(e.target.value) as never)} />
            </label>
          ))}

          <h3>Local</h3>
          <label className="field">
            <span>Nome do lugar</span>
            <input value={ev.place} onChange={(e) => set('place', e.target.value)} placeholder="Espaço tal" />
          </label>
          <label className="field">
            <span>Endereço</span>
            <input value={ev.address} onChange={(e) => set('address', e.target.value)} placeholder="Rua, número, bairro, cidade" />
          </label>
          <label className="field">
            <span>Link do Google Maps <em>opcional</em></span>
            <input value={ev.maps_url} onChange={(e) => set('maps_url', e.target.value)} inputMode="url" />
          </label>
          <button className="btn ghost small" onClick={findOnMap} disabled={busy || !(ev.address || ev.place)}>Achar no mapa</button>
          <PlaceMap lat={ev.lat} lng={ev.lng} />


          <button className="btn primary wide" disabled={busy} onClick={() => run(() => admin.saveEvent(ev), 'Salvo. Todo mundo vê na hora.')}>
            Salvar evento
          </button>
        </section>
      )}

      {ev && (
        <section className="panel admin-section">
          <h3>Missões com pessoas</h3>
          <p className="page-note">O app sorteia convidados pra cada um sair na foto e confere pelo rosto. Começa com 1 pessoa e aumenta 1 a cada 2 cumpridas. Cada convidado pode trocar as pessoas 3 vezes.</p>
          <label className="admin-mini">
            <input type="checkbox" checked={ev.gen_missions} onChange={(e) => set('gen_missions', e.target.checked)} /> Ligadas
          </label>
          <label className="field">
            <span>Até quantas pessoas por foto</span>
            <select value={ev.gen_max_people} onChange={(e) => set('gen_max_people', Number(e.target.value))}>
              {PEOPLE_POINTS.map((_, i) => (
                <option key={i} value={i + 1}>{i + 1} {i ? 'pessoas' : 'pessoa'}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Começam quando a festa tiver quantos convidados</span>
            <input type="number" min={2} max={500} value={ev.gen_min_guests} onChange={(e) => set('gen_min_guests', Number(e.target.value))} />
          </label>
          <p className="page-note">
            Pontos: {PEOPLE_POINTS.slice(0, ev.gen_max_people).map((pts, i) => `${i + 1} ${i ? 'pessoas' : 'pessoa'} ${pts}`).join(' · ')}
          </p>
          <button
            className="btn primary small"
            disabled={busy}
            onClick={() => run(() => admin.saveEvent({ gen_missions: ev.gen_missions, gen_max_people: ev.gen_max_people, gen_min_guests: ev.gen_min_guests }), 'Missões com pessoas salvas.')}
          >
            Salvar
          </button>
        </section>
      )}

      <section className="panel admin-section">
        <h3>Missões extras</h3>
        <ul className="admin-missions">
          {missions.map((m) => {
            const d = row(m)
            const edit = (p: Partial<typeof d>) => setDraft((x) => ({ ...x, [m.id]: { ...d, ...p } }))
            return (
              <li key={m.id}>
                <input value={d.title} onChange={(e) => edit({ title: e.target.value })} aria-label="Missão" />
                <input type="number" min={1} max={500} value={d.points} onChange={(e) => edit({ points: Number(e.target.value) })} aria-label="Pontos" />
                <label className="admin-mini"><input type="checkbox" checked={d.active} onChange={(e) => edit({ active: e.target.checked })} /> ativa</label>
                <input className="admin-target" value={d.target} onChange={(e) => edit({ target: e.target.value })} placeholder="Quem tem que aparecer (opcional)" aria-label="Quem tem que aparecer" />
                {draft[m.id] && (
                  <button className="btn primary small" disabled={busy} onClick={() => run(async () => { await admin.saveMission({ id: m.id, ...d, sort: m.sort }); setDraft((x) => { const next = { ...x }; delete next[m.id]; return next }) }, 'Missão salva.')}>
                    Salvar
                  </button>
                )}
              </li>
            )
          })}
          <li className="admin-new">
            <input value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} placeholder="Nova missão" aria-label="Nova missão" />
            <input type="number" min={1} max={500} value={adding.points} onChange={(e) => setAdding({ ...adding, points: Number(e.target.value) })} aria-label="Pontos" />
            <input className="admin-target" value={adding.target} onChange={(e) => setAdding({ ...adding, target: e.target.value })} placeholder="Quem tem que aparecer (opcional)" aria-label="Quem tem que aparecer" />
            <button
              className="btn primary small"
              disabled={busy || adding.title.trim().length < 3}
              onClick={() => run(async () => { await admin.saveMission({ ...adding, active: true, sort: missions.length + 1 }); setAdding({ title: '', points: 15, target: '' }) }, 'Missão criada.')}
            >
              Criar
            </button>
          </li>
        </ul>
        <p className="page-note">Missões que você escreve, pra brincadeiras da festa (pista de dança, brinde, look). Valem 15 por padrão, menos que as com pessoas, porque sem "quem tem que aparecer" qualquer foto cumpre. O número é quanto a missão vale. Se preencher quem tem que aparecer, a missão só conta quando o reconhecimento achar o rosto dessa pessoa na foto (o nome não precisa ser exato, e a pessoa precisa ter cadastrado a selfie). Missão desativada some pra quem ainda não fez. Os pontos de quem já fez continuam.</p>
      </section>

      <section className="panel admin-section">
        <h3>Reconhecimento de rosto</h3>
        {faceStats && (
          <p className="page-note">
            {faceStats.selfies} {faceStats.selfies === 1 ? 'selfie pronta' : 'selfies prontas'} · {faceStats.pending} {faceStats.pending === 1 ? 'foto' : 'fotos'} na fila ·{' '}
            {faceStats.worker_seen ? `servidor visto ${new Date(faceStats.worker_seen).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'servidor ainda não conectou'}
          </p>
        )}
        {faceSecret ? (
          <div className="admin-secret">
            <code>{faceSecret}</code>
            <p className="page-note">
              Aparece só agora. No GitHub do app: Settings → Secrets and variables → Actions → New repository secret, nome <b>FACE_SECRET</b>, cola esse valor. O GitHub Actions roda o reconhecimento sozinho a cada meia hora e direto durante a festa.
            </p>
            <button className="btn ghost small" onClick={() => run(() => navigator.clipboard.writeText(faceSecret), 'Senha copiada.')}>Copiar senha</button>
          </div>
        ) : (
          <button
            className="btn ghost small"
            disabled={busy}
            onClick={() =>
              (!faceStats?.has_secret || confirm('Gerar outra senha? O servidor de rostos para até você trocar o FACE_SECRET no GitHub.')) &&
              run(async () => setFaceSecret(await admin.faceSecret()), 'Senha gerada.')
            }
          >
            {faceStats?.has_secret ? 'Trocar senha do servidor' : 'Gerar senha do servidor'}
          </button>
        )}
        <button
          className="btn ghost small danger"
          disabled={busy}
          onClick={() => confirm('Apagar todos os dados de rosto e quem aparece em cada foto? Use depois da festa.') && run(async () => { await admin.wipeFaces(); setFaceStats(await admin.faceStats()) }, 'Dados de rosto apagados.')}
        >
          Apagar dados de rosto
        </button>
      </section>

      <section className="panel admin-section">
        <h3>Álbum</h3>
        <p className="page-note">
          {r2 === undefined ? 'Conferindo onde as fotos ficam…' : r2 ? 'Originais guardados no Cloudflare R2 (10 GB grátis).' : 'Originais no armazenamento do app (1 GB grátis) até o R2 ser configurado.'}
        </p>
        {r2 && (
          <button className="btn ghost small" disabled={busy} onClick={() => run(r2Setup, 'R2 pronto pra receber fotos.')}>
            Preparar R2
          </button>
        )}
        <p className="page-note">Todas as fotos que estão no app, em qualidade cheia, em arquivos .zip de até 100 MB. Melhor fazer no computador.</p>
        <button
          className="btn primary wide"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const { downloadAll } = await import('../lib/album')
              const missing = await downloadAll((done, total) => setMsg(`Baixando ${done} de ${total}…`))
              return missing
            }, (missing) =>
              missing
                ? `Baixei quase tudo, mas ${missing} ${missing === 1 ? 'foto não veio' : 'fotos não vieram'} (a internet caiu?). Baixa de novo pra pegar o que faltou.`
                : 'Pronto! Confere a pasta de downloads.',
            )
          }
        >
          Baixar todas as fotos
        </button>
      </section>

      <section className="panel admin-section">
        <h3>Testes</h3>
        <p className="page-note">
          Tudo aqui vale só pra organização. Simular o horário muda só este celular. Fotos postadas fora do horário da festa ou do look
          são de teste: só quem é da organização vê, e o app dos convidados continua igual.{testClock && ' Simulação ligada.'}
        </p>
        <div className="admin-row wrap">
          {testMoments().map((p) => (
            <button key={p.label} className="btn ghost small" onClick={() => (location.href = `${APP_URL}?agora=${toLocal(new Date(p.at).toISOString())}`)}>{p.label}</button>
          ))}
          <button className="btn ghost small" onClick={() => (location.href = `${APP_URL}?agora=off`)}>Hora real</button>
        </div>
        <button
          className="btn ghost small danger"
          disabled={busy}
          onClick={() => confirm('Tirar do app as fotos de teste da organização? Fotos dos convidados ficam.') && run(async () => { const n = await admin.clearPhotos(); setStats(await admin.stats()); return n }, 'Fotos de teste removidas do app.')}
        >
          Limpar fotos de teste
        </button>
      </section>
    </div>
  )
}
