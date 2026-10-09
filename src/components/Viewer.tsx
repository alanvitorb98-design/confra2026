import type { Photo } from '../lib/types'

export function Viewer({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  return (
    <div className="viewer" onClick={onClose} role="dialog" aria-label="Foto em tela cheia">
      {photo.url ? <img src={photo.url} alt={photo.caption} /> : <span className="ph" style={{ background: photo.placeholder }} />}
      <div className="viewer-bar">
        <span>{photo.caption}</span>
        <span className="viewer-author">por {photo.author}</span>
      </div>
    </div>
  )
}
