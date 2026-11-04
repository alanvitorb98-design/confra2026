import { UserIcon } from './Icons'

/*
 * Profile pictures to pick from. The selfie is only for face matching and is never shown, so this is how a
 * guest gets a face on their profile. Kept on the phone only.
 *
 * Drawn like a small print: a thin ink line over a soft colour wash that sits a little off the line, as if
 * the colour plate slipped. Each one wears something for the party (a bow tie, a flower).
 */

const ink = 'var(--ink)'
const gold = 'var(--gold)'
const hi = 'var(--gold-hi)'
const deep = 'var(--gold-deep)'
const paper = 'var(--paper)'
const rose = '#d9a090'
const sage = '#b7c09a'
const W = 0.85

const ln = (d: string, w = W) => <path d={d} fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
const wash = (d: string, c: string, o = 1, dx = 1.3, dy = 1.5) => <path d={d} fill={c} fillOpacity={o} transform={`translate(${dx} ${dy})`} />
const tint = (d: string, c: string, o = 1) => wash(d, c, o, 0, 0)
const both = (d: string, c: string, o = 1) => (
  <>
    {wash(d, c, o)}
    {ln(d)}
  </>
)
const dot = (x: number, y: number, r = 0.95) => <circle cx={x} cy={y} r={r} fill={ink} />
const ground = <circle cx="24" cy="24" r="24" fill={gold} fillOpacity=".2" />
const shoulders = 'M7 49c1.5-8 8-12.5 17-12.5S39.5 41 41 49'
const bow = (y: number, c = gold) => (
  <>
    {both(`M24 ${y}l-4.6-2.4c-.5-.2-1 .1-1 .7v3.4c0 .6.5.9 1 .7zM24 ${y}l4.6-2.4c.5-.2 1 .1 1 .7v3.4c0 .6-.5.9-1 .7z`, c)}
    <circle cx="24" cy={y} r="1.2" fill={ink} />
  </>
)
const petals = [0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-1.7" rx="1.25" ry="1.7" transform={`rotate(${a})`} />)
const flower = (x: number, y: number, s = 1) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <g fill={rose} transform="translate(.4 .5)">{petals}</g>
    <g fill="none" stroke={ink} strokeWidth={(W * 0.8) / s}>{petals}</g>
    <circle r=".8" fill={gold} />
  </g>
)
const leaf = (x: number, y: number, r: number, s = 1) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
    {wash('M0 0c1.6-2.2 4.6-2.4 6-1.4-1 2.2-3.8 2.8-6 1.4z', sage, 1, 0.4, 0.5)}
    {ln('M0 0c1.6-2.2 4.6-2.4 6-1.4-1 2.2-3.8 2.8-6 1.4zM0 0l4.2-1.2', (W * 0.85) / s)}
  </g>
)

const DRAWINGS = {
  gato: (
    <>
      {ground}
      {both(shoulders, hi, 0.8)}
      {both('M12.5 26.5c0-3.6 1-6.6 2.8-8.8l-.9-7.4 6.3 4.3c1.1-.3 2.2-.4 3.3-.4s2.2.1 3.3.4l6.3-4.3-.9 7.4c1.8 2.2 2.8 5.2 2.8 8.8 0 5.4-5 8.7-11.5 8.7S12.5 31.9 12.5 26.5z', paper)}
      {tint('M16 13.8l.5 3.6 2.4-1.6zM32 13.8l-.5 3.6-2.4-1.6z', rose, 0.7)}
      {ln('M17.8 25.4q1.5-1.4 3 0M27.2 25.4q1.5-1.4 3 0')}
      <path d="M23.1 28.3h1.8l-.9 1z" fill={deep} stroke={deep} strokeWidth=".8" strokeLinejoin="round" />
      {ln('M24 29.4c0 .9-1.2 1.4-2 .8M24 29.4c0 .9 1.2 1.4 2 .8')}
      {ln('M10.4 28.2l4.4.5M11 31.2l3.9-1M37.6 28.2l-4.4.5M37 31.2l-3.9-1', 0.8)}
      {tint('M14.6 30.6a2 1.2 0 1 0 4 0a2 1.2 0 1 0-4 0zM29.4 30.6a2 1.2 0 1 0 4 0a2 1.2 0 1 0-4 0z', rose, 0.45)}
      {bow(38.6)}
    </>
  ),
  coelho: (
    <>
      {ground}
      {both('M8 49c1.5-7.5 7.5-11.5 16-11.5S38.5 41.5 40 49', sage, 0.55)}
      {both('M19.6 17.5c-2.4-4.6-3-10.6-1-12.2 2.2-1.6 4.6 4.6 4.6 11.4', paper)}
      {both('M26.4 16.6c.6-4.2 2.8-7.8 6-8.8 2.4-.6 2 3.4-.4 6.2l-3.6 3.8', paper)}
      {tint('M20.2 15.4c-1-2.6-1.4-5.8-.6-6.8.8 1 1.6 3.4 1.8 6.2zM28.4 14c1-1.8 2.2-3 3.2-3.4-.4 1.4-1.6 2.8-3.2 3.4z', rose, 0.6)}
      {both('M13 28c0-6.4 4.8-11.4 11-11.4S35 21.6 35 28c0 5.4-4.8 9-11 9s-11-3.6-11-9z', paper)}
      {dot(19.6, 26.6)}
      {dot(28.4, 26.6)}
      {tint('M14.6 30.4a2.2 1.4 0 1 0 4.4 0a2.2 1.4 0 1 0-4.4 0zM29 30.4a2.2 1.4 0 1 0 4.4 0a2.2 1.4 0 1 0-4.4 0z', rose, 0.45)}
      {ln('M23 29.4c.6.5 1.4.5 2 0M24 29.8v1.2c0 .9-1.1 1.3-1.7.8M24 31c0 .9 1.1 1.3 1.7.8')}
      {leaf(28.6, 17.8, -35)}
      {flower(27.6, 18.2, 0.95)}
    </>
  ),
  cachorro: (
    <>
      {ground}
      {both(shoulders, paper)}
      {both('M14 26c0-6.8 4.4-11.6 10-11.6S34 19.2 34 26c0 6-4.4 10-10 10s-10-4-10-10z', paper)}
      {tint('M27.4 15.6c2.6.8 4.4 3 5 6-1.6.6-4.2.2-5.4-1.8-.8-1.4-.6-3 .4-4.2z', hi)}
      {both('M15.4 17.4c-3.6.4-5.6 4.8-5 10.4.3 2.2 2.4 2.4 3.4.4l1.6-3.6M32.6 17.4c3.6.4 5.6 4.8 5 10.4-.3 2.2-2.4 2.4-3.4.4l-1.6-3.6', gold, 0.75)}
      {dot(20, 24.6)}
      {dot(28, 24.6)}
      <path d="M21.8 28.4c0-1 1-1.6 2.2-1.6s2.2.6 2.2 1.6c0 .9-1.1 1.6-2.2 1.6s-2.2-.7-2.2-1.6z" fill={ink} />
      {ln('M24 30v1.4M21.6 32.2c1.2.9 3.6.9 4.8 0')}
      {both('M23.1 32.6c0 1.7.4 2.5.9 2.5s.9-.8.9-2.5', rose)}
      <path d="M14.6 39.8c3 1.5 6.1 2.1 9.4 2.1s6.4-.6 9.4-2.1" fill="none" stroke={gold} strokeWidth="2" strokeLinecap="round" />
      {leaf(28.4, 41.2, -10, 0.8)}
      {flower(28, 41.4, 0.95)}
    </>
  ),
  urso: (
    <>
      {ground}
      {both(shoulders, gold, 0.5)}
      {both('M10 15.4a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0-8.4 0zM29.6 15.4a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0-8.4 0z', gold, 0.5)}
      {tint('M12.6 15.6a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0zM32.2 15.6a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0z', rose, 0.7)}
      {both('M12.6 25.6c0-6.6 5-11 11.4-11s11.4 4.4 11.4 11c0 6.2-5 10-11.4 10s-11.4-3.8-11.4-10z', gold, 0.5)}
      {both('M18.8 29.6c0-3 2.4-4.6 5.2-4.6s5.2 1.6 5.2 4.6c0 2.6-2.4 3.8-5.2 3.8s-5.2-1.2-5.2-3.8z', paper)}
      {dot(19, 23.2)}
      {dot(29, 23.2)}
      <path d="M22.5 27.6c0-.7.7-1.1 1.5-1.1s1.5.4 1.5 1.1-.7 1.3-1.5 1.3-1.5-.6-1.5-1.3z" fill={ink} />
      {ln('M24 29v1.1M22.2 30.8c1 .7 2.6.7 3.6 0')}
      {bow(38.6, rose)}
    </>
  ),
  raposa: (
    <>
      {ground}
      {both(shoulders, gold, 0.85)}
      {both('M17.4 40.2c1.8 1.7 4.2 2.6 6.6 2.6s4.8-.9 6.6-2.6c-2-1.3-4.2-2-6.6-2s-4.6.7-6.6 2z', paper)}
      {both('M11.6 21.4L10.4 8.8l8 6.2M36.4 21.4l1.2-12.6-8 6.2', gold, 0.85)}
      {tint('M12.6 12.4l.6 5.4 3-2.4zM35.4 12.4l-.6 5.4-3-2.4z', ink, 0.55)}
      {both('M10.6 24c0-6 5.6-10 13.4-10s13.4 4 13.4 10c0 1.8-.6 3.4-1.6 4.6L24 37.6l-11.8-9c-1-1.2-1.6-2.8-1.6-4.6z', gold, 0.85)}
      {both('M12.2 28.6c2.8-.6 6-.2 8.4 1.6L24 37.6l3.4-7.4c2.4-1.8 5.6-2.2 8.4-1.6L24 37.6z', paper)}
      {ln('M17.6 24.4q1.5-1.3 3 0M27.4 24.4q1.5-1.3 3 0')}
      <circle cx="24" cy="36.4" r="1.3" fill={ink} />
      {leaf(32.4, 13.6, -55)}
      {leaf(33, 13.4, 5)}
      {flower(32.4, 14, 0.8)}
    </>
  ),
  pinguim: (
    <>
      {ground}
      {both('M7 49c1-9 7.4-14 17-14s16 5 17 14', ink, 0.75)}
      {both('M17 49c.4-5.4 3-8.6 7-8.6s6.6 3.2 7 8.6', paper)}
      {both('M12.4 27.4c0-8 5-13.6 11.6-13.6s11.6 5.6 11.6 13.6c0 5.6-5 9.6-11.6 9.6s-11.6-4-11.6-9.6z', ink, 0.75)}
      <path d="M24 22.6c-1.6-2.4-5.4-2.4-6.6.4-1.2 2.8.4 6.6 6.6 10.2 6.2-3.6 7.8-7.4 6.6-10.2-1.2-2.8-5-2.8-6.6-.4z" fill={paper} />
      {dot(20.4, 25.4)}
      {dot(27.6, 25.4)}
      {both('M22 28.2l2-1 2 1-2 1.8z', gold)}
      {tint('M16.8 28.6a1.6 1 0 1 0 3.2 0a1.6 1 0 1 0-3.2 0zM28 28.6a1.6 1 0 1 0 3.2 0a1.6 1 0 1 0-3.2 0z', rose, 0.6)}
      {bow(39.4, rose)}
    </>
  ),
  passarinho: (
    <>
      {ground}
      <path d="M4 41.6c6-1.2 12-.4 18 1.6s14 2.6 22-.4" fill="none" stroke={gold} strokeWidth="1.8" strokeLinecap="round" />
      {leaf(36, 42.2, -20)}
      {leaf(9, 41.6, 200)}
      {leaf(30, 43, 30, 0.8)}
      {/* the tail fans out behind, on the side away from the beak */}
      {both('M16.4 33.4c-3.4.2-6.8 1.8-8.8 4.4 2.8.8 6.2.2 9.2-1.6M16.8 35.6c-2.6 1.2-4.6 3.2-5.4 5.6 2.6-.2 5.2-1.6 7-3.6', gold, 0.7)}
      {both('M14 30.6c0-8.4 4.6-15 11.4-15 6.4 0 10 5.4 10 12.4 0 7.6-5 12-11 12-6.2 0-10.4-3.4-10.4-9.4z', hi)}
      {both('M17.2 27.4c4-.4 8.4 2 9.6 6.2-4.2 1.2-8.4-1-9.6-6.2z', gold, 0.7)}
      {ln('M19.6 29.4c1.6 1 3.2 2.4 4.2 3.6', 0.8)}
      {ln('M26 14.4c.4-2 1.8-3 3.2-2.6M25.4 15.4c-.8-1.8-2.2-2.6-3.4-2')}
      {dot(28.6, 23)}
      {both('M34.6 23.4l4.4 1.6-4.2 1.8', gold)}
      {tint('M28.6 27a1.8 1.1 0 1 0 3.6 0a1.8 1.1 0 1 0-3.6 0z', rose, 0.6)}
      {ln('M20 41.8l-.6 3M24 42.2l.4 3')}
      {flower(39.6, 21.6, 0.85)}
    </>
  ),
  coruja: (
    <>
      {ground}
      {both(shoulders, gold, 0.45)}
      {both('M11.6 13.6l4.6 3.6c2.4-.8 5-1.2 7.8-1.2s5.4.4 7.8 1.2l4.6-3.6c1 3 1.4 6.2 1.4 9.6 0 8.2-6 13.4-13.8 13.4S10.2 31.4 10.2 23.2c0-3.4.4-6.6 1.4-9.6z', gold, 0.45)}
      {ln('M15.6 30.6c1.6 1.4 2.4 1.4 3.2 0 .8 1.4 1.6 1.4 2.4 0M26.8 30.6c.8 1.4 1.6 1.4 2.4 0 .8 1.4 1.6 1.4 3.2 0', 0.8)}
      {both('M13.8 23.4a4.6 4.6 0 1 0 9.2 0a4.6 4.6 0 1 0-9.2 0zM25 23.4a4.6 4.6 0 1 0 9.2 0a4.6 4.6 0 1 0-9.2 0z', paper)}
      {dot(18.8, 23.6, 1.8)}
      {dot(29.2, 23.6, 1.8)}
      <circle cx="19.4" cy="23" r=".55" fill={paper} />
      <circle cx="29.8" cy="23" r=".55" fill={paper} />
      {both('M22.6 27.4l1.4 2.8 1.4-2.8c-.9-.5-1.9-.5-2.8 0z', gold)}
      {leaf(14.2, 14.4, -150)}
      {leaf(19, 14.6, -20, 0.8)}
      {flower(15.6, 14.6, 0.95)}
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
    <svg className="avatar-drawing" viewBox="0 0 48 48" aria-hidden>
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
