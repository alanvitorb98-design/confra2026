import { motion } from 'motion/react'
import { useState } from 'react'
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
}

export function Viewer({ photo, onClose, canRemove, onRemove }: Props) {
  const [status, setStatus] = useState<string>()

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
        {photo.url ? <img src={photo.preview ?? photo.url} alt={photo.caption} crossOrigin="anonymous" /> : <span className="ph" style={{ background: photo.placeholder }} />}
      </motion.div>
      <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-text">
          <span>{photo.caption}</span>
          <span className="viewer-author">por {photo.author}</span>
          {photo.faces && photo.faces.length > 0 && <span className="viewer-faces">Aparece: {photo.faces.join(', ')}</span>}
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
    </motion.div>
  )
}
