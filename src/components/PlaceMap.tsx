import { EVENT } from '../lib/event'

/** OpenStreetMap of the party place, once the organizer has pinned it in the admin panel. */
export function PlaceMap({ lat = EVENT.lat, lng = EVENT.lng }: { lat?: number | null; lng?: number | null }) {
  if (lat == null || lng == null) return null
  const d = 0.004
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`
  return (
    <div className="place-map">
      <iframe title="Mapa do local" src={src} loading="lazy" referrerPolicy="no-referrer" />
    </div>
  )
}
