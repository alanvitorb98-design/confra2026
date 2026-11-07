/** True when the subscription was made with another key. A browser that does not say gets the benefit of the doubt. */
export function wrongKey(given: ArrayBuffer | null | undefined, ours: Uint8Array) {
  if (!given) return false
  const a = new Uint8Array(given)
  return a.length !== ours.length || a.some((b, i) => b !== ours[i])
}
