import { GridFloor } from './GridFloor'

// Peaks in a 400x100 box: tall sharp ridge behind, lower ridge in front, like the reference poster.
const BACK = 'M0 100 L0 70 L22 52 L44 72 L70 40 L96 66 L120 30 L146 60 L168 44 L196 74 L214 62 L240 20 L270 64 L292 46 L318 70 L344 34 L372 64 L400 50 L400 100 Z'
const FRONT = 'M0 100 L0 84 L30 66 L58 88 L88 62 L118 90 L150 70 L176 92 L206 58 L236 90 L262 74 L290 92 L322 64 L352 88 L380 72 L400 86 L400 100 Z'

interface Props {
  /** intro: sun rises, ridges draw in and the floor rushes in; ambient: calm backdrop behind the app */
  variant: 'intro' | 'ambient'
}

export function SynthScene({ variant }: Props) {
  return (
    <div className={`scene scene-${variant}`} aria-hidden>
      <div className="scene-sky" />
      <div className="scene-stars" />
      <div className="scene-sun" />
      <svg className="scene-mountains" viewBox="0 0 400 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="peak-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3b4aa8" />
            <stop offset=".55" stopColor="#151a52" />
            <stop offset="1" stopColor="#0a0b2e" />
          </linearGradient>
          <linearGradient id="peak-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a3488" />
            <stop offset=".6" stopColor="#0f1240" />
            <stop offset="1" stopColor="#080924" />
          </linearGradient>
        </defs>
        <path d={BACK} fill="url(#peak-back)" />
        <path d={BACK} className="ridge ridge-back" />
        <path d={FRONT} fill="url(#peak-front)" />
        <path d={FRONT} className="ridge ridge-front" />
      </svg>
      <div className="scene-ground">
        <GridFloor speed={variant === 'intro' ? 2.4 : 0.5} />
      </div>
      <div className="scene-horizon" />
    </div>
  )
}
