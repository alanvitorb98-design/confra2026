import { useEffect, useRef, useState } from 'react'

type Light = 'ok' | 'dark' | 'bright' | 'backlit'

const LIGHT_TEXT: Record<Light, string> = {
  ok: 'Luz boa',
  dark: 'Pouca luz: chega perto de uma lâmpada ou janela',
  bright: 'Luz forte demais: sai do sol direto',
  backlit: 'Luz atrás de você: vira de frente pra luz',
}

/** Average brightness of the face area and of the border, from a tiny copy of the video frame. */
function measure(video: HTMLVideoElement, canvas: HTMLCanvasElement): Light {
  const n = 48
  canvas.width = n
  canvas.height = n
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(video, 0, 0, n, n)
  const px = ctx.getImageData(0, 0, n, n).data
  let mid = 0, midN = 0, edge = 0, edgeN = 0
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4
      const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
      const center = Math.abs(x - n / 2) < n / 5 && Math.abs(y - n / 2) < n / 4
      if (center) { mid += l; midN++ } else { edge += l; edgeN++ }
    }
  mid /= midN
  edge /= edgeN
  if (mid < 70) return edge - mid > 50 ? 'backlit' : 'dark'
  if (mid > 215) return 'bright'
  return 'ok'
}

/**
 * Front camera with a face guide and a live light check, so the selfie the face server gets is usable.
 * Falls back to the phone's own camera app when the browser can't open the camera here.
 */
export function SelfieCam({ onShot, onClose }: { onShot: (f: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const probe = useRef<HTMLCanvasElement>(null)
  const fallback = useRef<HTMLInputElement>(null)
  const [light, setLight] = useState<Light>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let stream: MediaStream | undefined
    let timer: number | undefined
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        stream = s
        const v = video.current!
        v.srcObject = s
        return v.play()
      })
      .then(() => {
        timer = window.setInterval(() => {
          if (video.current && probe.current && video.current.videoWidth) setLight(measure(video.current, probe.current))
        }, 300)
      })
      .catch(() => setFailed(true))
    if (!navigator.mediaDevices) setFailed(true)
    return () => {
      clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const shoot = () => {
    const v = video.current
    if (!v?.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    c.toBlob((b) => b && onShot(new File([b], 'selfie.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.92)
  }

  return (
    <div className="selfie-cam" role="dialog" aria-label="Tirar selfie">
      <input ref={fallback} type="file" accept="image/*" capture="user" hidden onChange={(e) => e.target.files?.[0] && onShot(e.target.files[0])} />
      {failed ? (
        <div className="selfie-cam-fail">
          <p>Não consegui abrir a câmera aqui. Tira pela câmera do celular: de frente, com o rosto inteiro e um pouco de espaço em volta.</p>
          <button className="btn primary" onClick={() => fallback.current?.click()}>Abrir câmera</button>
        </div>
      ) : (
        <>
          <video ref={video} playsInline muted />
          <div className="selfie-guide" aria-hidden />
          <p className={`selfie-light ${light ?? ''}`} role="status">{light ? LIGHT_TEXT[light] : 'Abrindo a câmera…'}</p>
          <p className="selfie-tip">Encaixe o rosto no contorno, sem óculos escuros</p>
          <button className="selfie-shoot" onClick={shoot} disabled={!light} aria-label="Tirar selfie"><span /></button>
        </>
      )}
      <button className="selfie-close btn ghost small" onClick={onClose}>Cancelar</button>
      <canvas ref={probe} hidden />
    </div>
  )
}
