import { UserIcon } from './Icons'

/*
 * Profile pictures to pick from, drawn in the app's ink-and-gold line. The selfie is only for face matching
 * and is never shown, so this is how a guest gets a face on their profile. Kept on the phone only.
 */

const ink = 'var(--ink)'
const gold = 'var(--gold)'
const paper = 'var(--paper)'
const line = { fill: 'none', stroke: ink, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const face = { ...line, fill: paper }
const eyes = (y = 25, dx = 5) => (
  <>
    <circle cx={24 - dx} cy={y} r="1.6" fill={ink} />
    <circle cx={24 + dx} cy={y} r="1.6" fill={ink} />
  </>
)
const cheeks = (y = 29) => (
  <>
    <circle cx="15.5" cy={y} r="2" fill={gold} fillOpacity=".45" />
    <circle cx="32.5" cy={y} r="2" fill={gold} fillOpacity=".45" />
  </>
)

const DRAWINGS = {
  gato: (
    <>
      <path d="M12 20l1-11 8 6M36 20l-1-11-8 6" {...face} />
      <circle cx="24" cy="26" r="13" {...face} />
      {eyes()}
      {cheeks()}
      <path d="M22.5 29.5l1.5 1.2 1.5-1.2M9 27l6 1M9 31l6-.5M39 27l-6 1M39 31l-6-.5" {...line} />
    </>
  ),
  cachorro: (
    <>
      <circle cx="24" cy="25" r="13" {...face} />
      <path d="M13 15c-5 2-6 10-3 14 3-2 5-7 5-11M35 15c5 2 6 10 3 14-3-2-5-7-5-11" {...line} fill={gold} fillOpacity=".55" />
      {eyes(24)}
      <ellipse cx="24" cy="30" rx="2.6" ry="1.9" fill={ink} />
      <path d="M24 32v1.5c0 1.5 2.5 1.5 2.5 0" {...line} />
    </>
  ),
  coelho: (
    <>
      <path d="M19 15c-3-6-3-12 0-12s4 6 3 12M29 15c3-6 3-12 0-12s-4 6-3 12" {...face} />
      <circle cx="24" cy="28" r="12" {...face} />
      {eyes(27)}
      {cheeks(31)}
      <path d="M22.5 30.5l1.5 1.2 1.5-1.2M24 31.7v1.6" {...line} />
    </>
  ),
  urso: (
    <>
      <circle cx="13.5" cy="15" r="5" {...line} fill={gold} fillOpacity=".55" />
      <circle cx="34.5" cy="15" r="5" {...line} fill={gold} fillOpacity=".55" />
      <circle cx="24" cy="26" r="13" {...line} fill={gold} fillOpacity=".55" />
      <ellipse cx="24" cy="30.5" rx="6" ry="4.5" {...face} />
      {eyes(24)}
      <ellipse cx="24" cy="29" rx="2" ry="1.4" fill={ink} />
    </>
  ),
  raposa: (
    <>
      <path d="M11 10l5 12h16l5-12-9 7h-8z" {...line} fill={gold} />
      <path d="M11 20c0 9 6 16 13 18 7-2 13-9 13-18-4 2-9 3-13 3s-9-1-13-3z" {...line} fill={gold} />
      <path d="M17 28c2 5 4.5 8 7 10 2.5-2 5-5 7-10-2 1-4.5 1.5-7 1.5s-5-.5-7-1.5z" {...face} />
      {eyes(25)}
      <circle cx="24" cy="33" r="1.4" fill={ink} />
    </>
  ),
  panda: (
    <>
      <circle cx="13.5" cy="15" r="4.5" fill={ink} />
      <circle cx="34.5" cy="15" r="4.5" fill={ink} />
      <circle cx="24" cy="26" r="13" {...face} />
      <ellipse cx="18.5" cy="25" rx="3.4" ry="4.2" transform="rotate(20 18.5 25)" fill={ink} />
      <ellipse cx="29.5" cy="25" rx="3.4" ry="4.2" transform="rotate(-20 29.5 25)" fill={ink} />
      <circle cx="18.8" cy="24.6" r="1" fill={paper} />
      <circle cx="29.2" cy="24.6" r="1" fill={paper} />
      <ellipse cx="24" cy="30.5" rx="1.8" ry="1.3" fill={ink} />
    </>
  ),
  pintinho: (
    <>
      <path d="M22 11c0-3 2-4 3-2M25 11c1-3 3-3 3-1" {...line} />
      <circle cx="24" cy="26" r="14" {...line} fill={gold} />
      {eyes(23, 5.5)}
      <path d="M21 27.5l3 3 3-3z" {...line} fill="var(--gold-deep)" />
      <circle cx="14.5" cy="29" r="2" fill={paper} fillOpacity=".6" />
      <circle cx="33.5" cy="29" r="2" fill={paper} fillOpacity=".6" />
    </>
  ),
  coruja: (
    <>
      <path d="M11 13l5 5M37 13l-5 5" {...line} />
      <path d="M11 13c0 0 3 1 13 1s13-1 13-1v15c0 7-6 12-13 12s-13-5-13-12z" {...line} fill={gold} fillOpacity=".55" />
      <circle cx="18" cy="24" r="5" {...face} />
      <circle cx="30" cy="24" r="5" {...face} />
      <circle cx="18" cy="24" r="2" fill={ink} />
      <circle cx="30" cy="24" r="2" fill={ink} />
      <path d="M22.5 29l1.5 2.5 1.5-2.5z" {...line} fill="var(--gold-deep)" />
    </>
  ),
} as const

export type AvatarId = keyof typeof DRAWINGS
const AVATARS = Object.keys(DRAWINGS) as AvatarId[]
const isAvatar = (id: unknown): id is AvatarId => typeof id === 'string' && id in DRAWINGS

/** The guest's picture: the drawing they picked, or the plain user icon. */
export function Avatar({ id }: { id?: string }) {
  if (!isAvatar(id)) return <UserIcon />
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      {DRAWINGS[id]}
    </svg>
  )
}

/** The drawings to pick from, plus the plain icon to go back to none. */
export function AvatarPicker({ value, onPick }: { value?: string; onPick: (id: AvatarId | undefined) => void }) {
  return (
    <div className="avatar-picker" role="radiogroup" aria-label="Foto de perfil">
      {[undefined, ...AVATARS].map((id) => (
        <button
          key={id ?? 'padrao'}
          type="button"
          role="radio"
          aria-checked={(isAvatar(value) ? value : undefined) === id}
          aria-label={id ?? 'padrão'}
          className="avatar-option"
          onClick={() => onPick(id)}
        >
          <Avatar id={id} />
        </button>
      ))}
    </div>
  )
}
