import { BRAND } from '../brand/brand'
/** Wordmark: a small top line over a bigger main line (see BRAND), with the monogram above on big screens. */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <h1 className={`logo${small ? ' small' : ''}`}>
      {!small && BRAND.monogram ? <img className="logo-mono" src={`${import.meta.env.BASE_URL}${BRAND.monogram}`} alt="" /> : null}
      <span className="logo-top">{BRAND.wordmarkTop}</span>
      <span className="logo-main">{BRAND.wordmarkMain}</span>
    </h1>
  )
}
