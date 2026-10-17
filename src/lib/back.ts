import { useEffect, useRef } from 'react'

// The phone's back button closes what is open on top (a photo, the camera, a panel) instead of leaving
// the app: each open layer adds a step to the browser history, and going back takes it out.
type Layer = { close: () => boolean | void }
const layers: Layer[] = []
// steps this app took out itself (a layer closed by a tap): their "back" closes nothing
let skip = 0

if (typeof window !== 'undefined')
  window.addEventListener('popstate', () => {
    if (skip > 0) {
      skip--
      return
    }
    const top = layers[layers.length - 1]
    if (!top) return
    // a layer that must not close this way (a photo not posted yet) stays, with its step back in place
    if (top.close() === false) history.pushState({ layer: layers.length }, '')
    else layers.pop()
  })

/** While `open`, the back button calls `close` (return false to stay open) instead of leaving the app. */
export function useBack(open: boolean, close: () => boolean | void) {
  const latest = useRef(close)
  latest.current = close
  useEffect(() => {
    if (!open) return
    const layer: Layer = { close: () => latest.current() }
    layers.push(layer)
    history.pushState({ layer: layers.length }, '')
    return () => {
      // closed in the app, not with back: its step comes out of the history too
      const i = layers.indexOf(layer)
      if (i === -1) return
      layers.splice(i, 1)
      skip++
      history.back()
    }
  }, [open])
}
