import { storageKey } from '../brand/brand'
/** Bump when the terms text (components/Terms.tsx) changes: the guest's acceptance is stored with this version. */
export const TERMS_VERSION = '2026-10-15'
export const TERMS_KEY = storageKey('terms')

export function termsAccepted(): string | null {
  try {
    return localStorage.getItem(TERMS_KEY) === TERMS_VERSION ? TERMS_VERSION : null
  } catch {
    return null
  }
}
