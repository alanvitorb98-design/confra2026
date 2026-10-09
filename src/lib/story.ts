import type { Photo } from './types'

const W = 1080
const H = 1920

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawBackdrop(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#120a24')
  sky.addColorStop(0.55, '#3a1670')
  sky.addColorStop(0.72, '#2a0f45')
  sky.addColorStop(1, '#120a24')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  // sliced sun on the horizon
  const horizon = H * 0.74
  const r = 360
  const sun = ctx.createLinearGradient(0, horizon - r, 0, horizon)
  sun.addColorStop(0, '#ffe66d')
  sun.addColorStop(0.5, '#ffb13d')
  sun.addColorStop(1, '#ff3d9a')
  ctx.save()
  ctx.beginPath()
  ctx.arc(W / 2, horizon, r, Math.PI, 0)
  ctx.clip()
  ctx.shadowColor = '#ff3d9a'
  ctx.shadowBlur = 80
  ctx.fillStyle = sun
  ctx.fillRect(W / 2 - r, horizon - r, r * 2, r)
  ctx.fillStyle = '#2a0f45'
  for (let i = 0; i < 5; i++) ctx.fillRect(0, horizon - 150 + i * 32, W, 6 + i * 3)
  ctx.restore()

  // neon grid floor
  ctx.fillStyle = '#120a24'
  ctx.fillRect(0, horizon, W, H - horizon)
  ctx.strokeStyle = 'rgba(56,225,255,.6)'
  ctx.lineWidth = 3
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath()
    ctx.moveTo(W / 2 + i * 30, horizon)
    ctx.lineTo(W / 2 + i * 260, H)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255,61,154,.6)'
  for (let i = 0; i < 9; i++) {
    const y = horizon + Math.pow(i / 8, 2) * (H - horizon)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
}

/** Builds a 1080x1920 story card: the photo in its Polaroid over the synth horizon. */
export async function makeStory(photo: Photo): Promise<File> {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  drawBackdrop(ctx)

  // logo
  ctx.textAlign = 'center'
  ctx.font = '120px Audiowide, sans-serif'
  ctx.shadowColor = 'rgba(255,61,154,.8)'
  ctx.shadowBlur = 40
  const chrome = ctx.createLinearGradient(0, 120, 0, 250)
  chrome.addColorStop(0, '#ffffff')
  chrome.addColorStop(0.45, '#cfd6ff')
  chrome.addColorStop(0.5, '#5b3a9e')
  chrome.addColorStop(0.55, '#ffd6f0')
  chrome.addColorStop(1, '#ffffff')
  ctx.fillStyle = chrome
  ctx.fillText('CONFRA 26', W / 2, 240)
  ctx.shadowBlur = 0

  // polaroid
  const pw = 820
  const pad = 36
  const photoW = pw - pad * 2
  const photoH = Math.round(photoW * 1.25)
  const ph = pad + photoH + 190
  const px = (W - pw) / 2
  const py = 330
  ctx.save()
  ctx.translate(W / 2, py + ph / 2)
  ctx.rotate((photo.tilt * Math.PI) / 180)
  ctx.translate(-W / 2, -(py + ph / 2))
  ctx.shadowColor = 'rgba(0,0,0,.7)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 30
  const frame = ctx.createLinearGradient(0, py, 0, py + ph)
  if (photo.frame === 'chrome') {
    frame.addColorStop(0, '#f4f5fb')
    frame.addColorStop(0.45, '#b9bdd0')
    frame.addColorStop(0.55, '#6f7390')
    frame.addColorStop(1, '#d9dcea')
  } else {
    frame.addColorStop(0, '#2a2330')
    frame.addColorStop(1, '#1a1520')
  }
  ctx.fillStyle = frame
  ctx.fillRect(px, py, pw, ph)
  ctx.shadowColor = 'transparent'
  if (photo.frame === 'neon') {
    ctx.strokeStyle = '#ff3d9a'
    ctx.lineWidth = 6
    ctx.shadowColor = '#ff3d9a'
    ctx.shadowBlur = 40
    ctx.strokeRect(px + 3, py + 3, pw - 6, ph - 6)
    ctx.shadowBlur = 0
  }

  // photo, cropped to fill 4:5 at full source resolution
  if (photo.url) {
    const img = await loadImage(photo.url)
    const target = photoW / photoH
    const srcRatio = img.naturalWidth / img.naturalHeight
    let sw = img.naturalWidth
    let sh = img.naturalHeight
    if (srcRatio > target) sw = sh * target
    else sh = sw / target
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, px + pad, py + pad, photoW, photoH)
  }

  // caption + date stamp
  ctx.textAlign = 'left'
  ctx.font = '64px "Permanent Marker", cursive'
  ctx.fillStyle = photo.frame === 'chrome' ? '#2a2340' : photo.frame === 'neon' ? '#ffd6ec' : '#e9e2f5'
  ctx.fillText(photo.caption || 'confra 26', px + pad + 6, py + pad + photoH + 120, photoW - 12)
  ctx.font = 'bold 36px "Courier New", monospace'
  ctx.fillStyle = '#ff9a3d'
  ctx.shadowColor = 'rgba(255,120,30,.9)'
  ctx.shadowBlur = 12
  ctx.textAlign = 'right'
  ctx.fillText("'26 11 07", px + pad + photoW - 20, py + pad + photoH - 24)
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.font = '600 40px "Chakra Petch", sans-serif'
  ctx.fillStyle = '#38e1ff'
  ctx.shadowColor = 'rgba(56,225,255,.8)'
  ctx.shadowBlur = 16
  ctx.fillText(`por ${photo.author}`, W / 2, py + ph + 110)

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/jpeg', 0.95))
  return new File([blob], `confra26-story-${photo.id.slice(0, 8)}.jpg`, { type: 'image/jpeg' })
}
