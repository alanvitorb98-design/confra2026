import { useEffect, useRef, useState } from 'react'
import { Develop } from './components/Develop'
import { Feed } from './components/Feed'
import { Missions } from './components/Missions'
import { Profile } from './components/Profile'
import { Ranking } from './components/Ranking'
import { Viewer } from './components/Viewer'
import { Welcome } from './components/Welcome'
import { exampleAppearances, exampleMissions, examplePhotos, examplePoints } from './lib/mock'
import { playShutter } from './lib/sound'
import type { Guest, Photo, Reaction } from './lib/types'

type Tab = 'feed' | 'missions' | 'ranking' | 'me'

const GUEST_KEY = 'confra26.guest'

function loadGuest(): Guest | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    return raw ? (JSON.parse(raw) as Guest) : null
  } catch {
    return null
  }
}

export default function App() {
  const [guest, setGuest] = useState<Guest | null>(loadGuest)
  const [tab, setTab] = useState<Tab>('feed')
  const [photos, setPhotos] = useState<Photo[]>(examplePhotos)
  const [shot, setShot] = useState<File | null>(null)
  const [open, setOpen] = useState<Photo | null>(null)
  const camera = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!guest) return
    try {
      // the selfie object URL dies with the page, so only the profile text is kept
      localStorage.setItem(GUEST_KEY, JSON.stringify({ ...guest, selfieUrl: undefined }))
    } catch {
      /* private mode: the guest simply signs in again next time */
    }
  }, [guest])

  if (!guest) return <Welcome onEnter={setGuest} />

  const shoot = () => camera.current?.click()

  const react = (id: string, r: Reaction) =>
    setPhotos((list) =>
      list.map((p) => {
        if (p.id !== id) return p
        const on = !p.mine[r]
        return { ...p, mine: { ...p.mine, [r]: on }, reactions: { ...p.reactions, [r]: p.reactions[r] + (on ? 1 : -1) } }
      }),
    )

  const post = (caption: string) => {
    if (!shot) return
    const photo: Photo = {
      id: crypto.randomUUID(),
      author: guest.name,
      caption,
      // the untouched original File: no resizing or recompression anywhere
      url: URL.createObjectURL(shot),
      takenAt: new Date(),
      reactions: { '🔥': 0, '😂': 0, '😍': 0, '🕺': 0 },
      mine: {},
      tilt: Math.round((Math.random() * 4 - 2) * 10) / 10,
    }
    setPhotos((list) => [photo, ...list])
    setShot(null)
    setTab('feed')
    window.scrollTo({ top: 0 })
  }

  const myPhotos = photos.filter((p) => p.author === guest.name).length

  return (
    <div className="app">
      <div className="horizon" aria-hidden />

      <header className="topbar">
        <h1 className="logo small">CONFRA<span>26</span></h1>
        <span className="topbar-count">{photos.length} fotos</span>
      </header>

      <main>
        {tab === 'feed' && <Feed photos={photos} onReact={react} onOpen={setOpen} />}
        {tab === 'missions' && <Missions missions={exampleMissions} onShoot={shoot} />}
        {tab === 'ranking' && <Ranking points={examplePoints} appearances={exampleAppearances} />}
        {tab === 'me' && (
          <Profile
            guest={guest}
            myPhotos={myPhotos}
            points={0}
            onLeave={() => {
              try { localStorage.removeItem(GUEST_KEY) } catch { /* ignore */ }
              setGuest(null)
            }}
          />
        )}
      </main>

      <nav className="tabbar">
        <button aria-current={tab === 'feed'} onClick={() => setTab('feed')}>Feed</button>
        <button aria-current={tab === 'missions'} onClick={() => setTab('missions')}>Missões</button>
        <button className="shutter" onClick={shoot} aria-label="Tirar foto"><span /></button>
        <button aria-current={tab === 'ranking'} onClick={() => setTab('ranking')}>Ranking</button>
        <button aria-current={tab === 'me'} onClick={() => setTab('me')}>Eu</button>
      </nav>

      <input
        ref={camera}
        id="camera"
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          playShutter()
          setShot(f)
        }}
      />

      {shot && <Develop key={shot.name + shot.lastModified} file={shot} onPost={post} onDiscard={() => setShot(null)} />}
      {open && <Viewer photo={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
