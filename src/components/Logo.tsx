/** Serif wordmark from the invitation: "CONFRA" over a bigger "DA FIRMA". */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <h1 className={`logo${small ? ' small' : ''}`}>
      <span className="logo-top">Confra</span>
      <span className="logo-main">da Firma</span>
    </h1>
  )
}
