import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBack } from '../lib/back'
import { loadSpots, tagSpot, untagMe, type Spot } from '../lib/backend'
import { savePhoto, shareOrDownload } from '../lib/download'
import { makeStory } from '../lib/story'
import type { Photo } from '../lib/types'

const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.ceil(bytes / 1024)} KB`

interface Props {
  photo: Photo
  onClose: () => void
  /** the author or an organizer */
  canRemove?: boolean
  onRemove?: () => Promise<void>
  /** the guest looking */
  me?: string
  /** the author or an organizer: can say who each face is */
  canTag?: boolean
  /** everyone in the app, id -> name */
  guests?: Map<string, string>
}

/** spot being tagged: an existing one, or a new point tapped on the photo */
type Picking = { spot: Spot | null; at?: { x: number; y: number } }

export function Viewer({ photo, onClose, canRemove, onRemove, me, canTag, guests }: Props) {
  const [status, setStatus] = useState<string>()
  const [spots, setSpots] = useState<Spot[]>([])
  const [picking, setPicking] = useState<Picking>()
  useBack(!!picking, () => setPicking(undefined))
  const live = !!photo.url && !photo.status && !!me

  const refresh = useCallback(() => {
    if (live) loadSpots(photo.id).then(setSpots).catch(() => undefined)
  }, [live, photo.id])
  // again when the face server (or someone else) changes who appears
  const facesKey = photo.faces?.join('|')
  useEffect(refresh, [refresh, facesKey])

  const choose = async (guestId: string | null) => {
    const p = picking
    setPicking(undefined)
    if (!p) return
    try {
      await tagSpot(photo.id, p.spot?.id ?? null, guestId, p.at)
      setStatus(guestId ? `${guests?.get(guestId) ?? 'Convidado'} marcado` : 'Marcação tirada')
    } catch {
      setStatus('Não deu pra marcar. Tenta de novo.')
    }
    refresh()
  }

  const tapPhoto = (e: React.MouseEvent<HTMLDivElement>) => {
    // a tap on the photo itself never closes it: only the X or the dark area around does
    e.stopPropagation()
    if (!canTag || !live) return
    const r = e.currentTarget.getBoundingClientRect()
    setPicking({ spot: null, at: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } })
  }

  const tapSpot = async (e: React.MouseEvent, s: Spot) => {
    e.stopPropagation()
    if (canTag) return setPicking({ spot: s })
    if (s.guestId && s.guestId === me && confirm('Tirar sua marcação dessa foto?')) {
      const ok = await untagMe(s.id).then(
        () => true,
        () => false,
      )
      setStatus(ok ? 'Marcação tirada' : 'Não deu pra tirar (a internet caiu?). Tenta de novo.')
      if (ok) refresh()
    }
  }

  const [busy, setBusy] = useState(false)

  const run = async (job: () => Promise<'shared' | 'downloaded' | 'cancelled'>) => {
    setBusy(true)
    try {
      const r = await job()
      if (r !== 'cancelled') setStatus(r === 'shared' ? 'Pronto!' : 'Salvo no aparelho')
    } catch {
      setStatus('Não deu certo. Tenta de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div className="viewer" onClick={onClose} role="dialog" aria-label="Foto em tela cheia" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="viewer-photo" initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
        {photo.url ? (
          <div className={`viewer-frame${canTag && live ? ' tagging' : ''}`} onClick={tapPhoto}>
            <img src={photo.preview ?? photo.url} alt={photo.caption} crossOrigin="anonymous" />
            {spots.map((s) => {
              const name = s.guestId ? guests?.get(s.guestId) ?? 'Convidado' : null
              // faces nobody named yet only show to whoever can name them
              if (!name && (!canTag || s.byHand)) return null
              const box = s.w > 0 && s.h > 0
              return (
                <button
                  key={s.id}
                  className={`spot${box ? ' box' : ' point'}${name ? '' : ' unknown'}${s.guestId && s.guestId === me ? ' me' : ''}`}
                  style={box ? { left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%` } : { left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
                  onClick={(e) => tapSpot(e, s)}
                  aria-label={name ? `Marcado: ${name}` : 'Rosto sem nome, toca pra marcar'}
                >
                  <span className="spot-name">{name ?? '?'}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <span className="ph" style={{ background: photo.placeholder }} onClick={(e) => e.stopPropagation()} />
        )}
      </motion.div>
      <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-text">
          <span>{photo.caption}</span>
          <span className="viewer-author">por {photo.author}</span>
          {photo.test && <span className="viewer-hint">Foto de teste: só a organização vê</span>}
          {photo.faces && photo.faces.length > 0 && <span className="viewer-faces">Aparece: {photo.faces.join(', ')}</span>}
          {canTag && live && <span className="viewer-hint">Toca num rosto pra marcar quem é</span>}
        </div>
        {photo.url ? (
          <div className="viewer-actions">
            <button className="btn ghost small" disabled={busy} onClick={() => run(() => savePhoto(photo))}>
              Baixar original{photo.bytes ? ` · ${size(photo.bytes)}` : ''}
            </button>
            <button className="btn primary small" disabled={busy} onClick={() => run(async () => shareOrDownload(await makeStory(photo)))}>
              {busy ? 'Montando…' : 'Postar no Story'}
            </button>
            {canRemove && onRemove && (
              <button
                className="btn ghost small danger"
                disabled={busy}
                onClick={() => confirm('Apagar essa foto pra todo mundo?') && run(async () => { await onRemove(); return 'cancelled' })}
              >
                Apagar
              </button>
            )}
            {status && <span className="viewer-status">{status}</span>}
          </div>
        ) : (
          <span className="viewer-author">Foto de exemplo</span>
        )}
      </div>
      <button className="viewer-close" onClick={onClose} aria-label="Fechar">✕</button>
      {picking && guests && <Picker guests={guests} current={picking.spot?.guestId ?? null} canClear={!!picking.spot} onPick={choose} onCancel={() => setPicking(undefined)} />}
    </motion.div>
  )
}

/** Who is it: everyone in the app, with a search. */
function Picker({ guests, current, canClear, onPick, onCancel }: { guests: Map<string, string>; current: string | null; canClear: boolean; onPick: (id: string | null) => void; onCancel: () => void }) {
  const [q, setQ] = useState('')
  const plain = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const list = useMemo(() => {
    const k = plain(q.trim())
    return [...guests]
      .filter(([, n]) => !k || plain(n).includes(k))
      .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [guests, q])
  return (
    <motion.div className="picker" role="dialog" aria-label="Quem é?" onClick={(e) => { e.stopPropagation(); onCancel() }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="picker-sheet" onClick={(e) => e.stopPropagation()} initial={{ y: 40 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
        <div className="picker-head">
          <strong>Quem é?</strong>
          <button className="btn ghost small" onClick={onCancel}>Cancelar</button>
        </div>
        <input className="picker-search" type="search" placeholder="Buscar pelo nome" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={false} />
        <ul className="picker-list">
          {canClear && current && (
            <li><button className="picker-clear" onClick={() => onPick(null)}>Tirar marcação</button></li>
          )}
          {canClear && !current && (
            <li><button className="picker-clear" onClick={() => onPick(null)}>Ninguém do app</button></li>
          )}
          {list.map(([id, name]) => (
            <li key={id}>
              <button className={id === current ? 'on' : ''} onClick={() => onPick(id)}>{name}</button>
            </li>
          ))}
          {list.length === 0 && <li className="picker-empty">Ninguém com esse nome no app.</li>}
        </ul>
      </motion.div>
    </motion.div>
  )
}
