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

function burst(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rays: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = '#d9a52b'
  ctx.fillStyle = '#f6d77c'
  ctx.lineCap = 'round'
  ctx.lineWidth = r * 0.05
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2
    const long = i % 2 === 0
    const r1 = r * (long ? 0.34 : 0.4)
    const r2 = r * (long ? 0.88 : 0.7)
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1)
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2)
    ctx.stroke()
    if (long) {
      ctx.beginPath()
      ctx.arc(Math.cos(a) * (r2 + r * 0.07), Math.sin(a) * (r2 + r * 0.07), r * 0.045, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

// Cream paper with gold confetti and fireworks, like the invitation
function drawBackdrop(ctx: CanvasRenderingContext2D) {
  const paper = ctx.createLinearGradient(0, 0, 0, H)
  paper.addColorStop(0, '#fcf5de')
  paper.addColorStop(0.5, '#fbf3d9')
  paper.addColorStop(1, '#f6e8bd')
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)

  burst(ctx, W / 2, 0, 300, 18)
  burst(ctx, W, 420, 220, 14)
  burst(ctx, 0, 380, 200, 12)
  burst(ctx, 90, H - 200, 230, 16)
  burst(ctx, W - 110, H - 230, 260, 18)

  const dots: [number, number, number, boolean][] = [
    [70, 160, 34, false], [250, 90, 18, true], [930, 300, 44, true], [1020, 760, 20, false], [40, 700, 22, true],
    [980, 1180, 30, false], [60, 1300, 18, false], [500, H - 60, 52, true], [800, 1700, 22, true], [330, 1760, 16, false],
  ]
  for (const [x, y, r, pale] of dots) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 1, x, y, r)
    g.addColorStop(0, pale ? '#f8e6ad' : '#fbe7a4')
    g.addColorStop(1, pale ? '#f0d68a' : '#c4911a')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Builds a 1080x1920 story card: the photo in its Polaroid on the invitation paper. */
export async function makeStory(photo: Photo): Promise<File> {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  drawBackdrop(ctx)

  // invitation title
  ctx.textAlign = 'center'
  ctx.fillStyle = '#1d1a16'
  ctx.font = '84px Gloock, Georgia, serif'
  ctx.fillText('CONFRA', W / 2, 170)
  ctx.font = '128px Gloock, Georgia, serif'
  ctx.fillText('DA FIRMA', W / 2, 290)

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
  ctx.shadowColor = 'rgba(60,40,10,.45)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 30
  const frame = ctx.createLinearGradient(0, py, 0, py + ph)
  if (photo.frame === 'gold') {
    frame.addColorStop(0, '#fbe8a6')
    frame.addColorStop(0.4, '#e0b448')
    frame.addColorStop(0.52, '#a8790f')
    frame.addColorStop(0.64, '#e9c565')
    frame.addColorStop(1, '#c9971f')
  } else if (photo.frame === 'dark') {
    frame.addColorStop(0, '#2b2621')
    frame.addColorStop(1, '#1a1714')
  } else {
    frame.addColorStop(0, '#fffdf7')
    frame.addColorStop(1, '#f1ece0')
  }
  ctx.fillStyle = frame
  ctx.fillRect(px, py, pw, ph)
  ctx.shadowColor = 'transparent'

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
  ctx.font = '700 84px Caveat, cursive'
  ctx.fillStyle = photo.frame === 'gold' ? '#3a2a08' : photo.frame === 'dark' ? '#f1e9d6' : '#2a241c'
  ctx.fillText(photo.caption || 'confra da firma', px + pad + 6, py + pad + photoH + 120, photoW - 12)
  ctx.font = 'bold 36px "Courier New", monospace'
  ctx.fillStyle = '#ff9a3d'
  ctx.shadowColor = 'rgba(255,120,30,.9)'
  ctx.shadowBlur = 12
  ctx.textAlign = 'right'
  ctx.fillText("'26 11 07", px + pad + photoW - 20, py + pad + photoH - 24)
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.font = '600 40px Outfit, sans-serif'
  ctx.fillStyle = '#a5770f'
  ctx.fillText(`por ${photo.author} · 07/11`, W / 2, py + ph + 110)

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/jpeg', 0.95))
  return new File([blob], `confra26-story-${photo.id.slice(0, 8)}.jpg`, { type: 'image/jpeg' })
}
