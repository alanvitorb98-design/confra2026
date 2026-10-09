import { motion } from 'motion/react'
import { useState } from 'react'
import { savePhoto, shareOrDownload } from '../lib/download'
import { makeStory } from '../lib/story'
import type { Photo } from '../lib/types'

const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.ceil(bytes / 1024)} KB`

export function Viewer({ photo, onClose }: { photo: Photo; onClose: () => void }) {
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
        {photo.url ? <img src={photo.url} alt={photo.caption} /> : <span className="ph" style={{ background: photo.placeholder }} />}
      </motion.div>
      <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-text">
          <span>{photo.caption}</span>
          <span className="viewer-author">por {photo.author}</span>
        </div>
        {photo.file ? (
          <div className="viewer-actions">
            <button className="btn ghost small" disabled={busy} onClick={() => run(() => savePhoto(photo))}>
              Baixar original · {size(photo.file.size)}
            </button>
            <button className="btn primary small" disabled={busy} onClick={() => run(async () => shareOrDownload(await makeStory(photo)))}>
              {busy ? 'Montando…' : 'Postar no Story'}
            </button>
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
