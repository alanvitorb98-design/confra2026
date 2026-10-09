// Shutter and "developed" sounds synthesized with Web Audio, so no audio files ship with the app.

let ctx: AudioContext | null = null

function audio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function playShutter() {
  const ac = audio()
  if (!ac) return
  const len = Math.floor(ac.sampleRate * 0.09)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const env = i < len * 0.15 ? 1 : Math.pow(1 - i / len, 3)
    data[i] = (Math.random() * 2 - 1) * env
  }
  const src = ac.createBufferSource()
  src.buffer = buf
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2400
  const gain = ac.createGain()
  gain.gain.value = 0.6
  src.connect(filter).connect(gain).connect(ac.destination)
  src.start()
}

export function playReveal() {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const osc = ac.createOscillator()
    osc.type = 'square'
    osc.frequency.value = f
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t + i * 0.07)
    g.gain.linearRampToValueAtTime(0.08, t + i * 0.07 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.25)
    osc.connect(g).connect(ac.destination)
    osc.start(t + i * 0.07)
    osc.stop(t + i * 0.07 + 0.3)
  })
}
