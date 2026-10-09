import { AnimatePresence } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Develop } from './components/Develop'
import { Feed } from './components/Feed'
import { Missions } from './components/Missions'
import { Profile } from './components/Profile'
import { Ranking } from './components/Ranking'
import { Viewer } from './components/Viewer'
import { Welcome } from './components/Welcome'
import { exampleAppearances, exampleMissions, examplePoints } from './lib/mock'
import { eventCode, hasSession, join, leave, useParty } from './lib/backend'
import { playShutter } from './lib/sound'
import type { Frame, Guest, Photo, Wall } from './lib/types'
import { Countdown } from './components/Countdown'
import { PhaseBar } from './components/PhaseBar'
import { LOOK_CLOSES, clock, lookOpen, phaseAt, testClock, useNow } from './lib/event'
import { Install } from './components/Install'
import { isInstalled } from './lib/install'
import { Splash } from './components/Splash'
import { Logo } from './components/Logo'
import { PartyScene } from './components/PartyScene'

type Tab = 'feed' | 'missions' | 'ranking' | 'me'

const GUEST_KEY = 'confra26.guest'

function loadGuest(): Guest | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    const g = raw ? (JSON.parse(raw) as Guest) : null
    // profiles saved before logins existed have no id: sign in again
    return g?.id ? g : null
  } catch {
    return null
  }
}

export default function App() {
  const [guest, setGuest] = useState<Guest | null>(loadGuest)
  const [tab, setTab] = useState<Tab>('feed')
  const [wall, setWall] = useState<Wall>('party')
  const [shot, setShot] = useState<File | null>(null)
  const [open, setOpen] = useState<Photo | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [code] = useState(eventCode)
  const [intro, setIntro] = useState(true)
  const [gate, setGate] = useState(() => !isInstalled())
  const t = useNow()
  const phase = phaseAt(t)
  const party = useParty(guest && phase !== 'countdown' ? guest : null)
  const photos = party.photos

  // the browser can clear the login: then the guest signs in again with the code
  useEffect(() => {
    if (guest) hasSession().then((ok) => !ok && setGuest(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!guest) return
    try {
      // the selfie object URL dies with the page, so only the profile text is kept
      localStorage.setItem(GUEST_KEY, JSON.stringify({ ...guest, selfieUrl: undefined }))
    } catch {
      /* private mode: the guest simply signs in again next time */
    }
  }, [guest])

  if (gate) return <Install code={code} onSkip={() => setGate(false)} />
  if (intro)
    return (
      <AnimatePresence>
        <Splash key="splash" onDone={() => setIntro(false)} />
      </AnimatePresence>
    )
  if (phase === 'countdown') return <Countdown />
  if (!guest) return <Welcome code={code} onEnter={async (c, g) => setGuest(await join(c, g))} />

  // before the party only the outfit wall exists; afterwards both, party first
  const showWall: Wall = phase === 'warmup' || phase === 'look' ? 'look' : wall
  const canShoot = phase === 'look' || phase === 'party'
  // while the outfit wall overlaps the party, the shutter posts to the wall on screen
  const looksOpen = lookOpen(t)
  const shootKind: Wall = phase === 'look' || (looksOpen && showWall === 'look' && tab === 'feed') ? 'look' : 'party'

  const shoot = () => canShoot && camera.current?.click()

  const post = (caption: string, frame: Frame, preview: string) => {
    if (!shot) return
    // the untouched original File goes up as is: no resizing or recompression anywhere
    party.post(shot, preview, shootKind, caption, frame)
    setWall(shootKind)
    setShot(null)
    setTab('feed')
    window.scrollTo({ top: 0 })
  }

  const myPhotos = photos.filter((p) => p.authorId === guest.id).length
  const wallPhotos = photos.filter((p) => p.kind === showWall)
  const total = (p: Photo) => Object.values(p.reactions).reduce((a, b) => a + b, 0)
  const bestLooks = photos
    .filter((p) => p.kind === 'look')
    .map((p) => ({ name: p.author, value: total(p) }))
    .sort((a, b) => b.value - a.value)
  const empty =
    party.state === 'loading'
      ? 'Carregando as fotos…'
      : party.state === 'offline'
        ? 'Sem conexão agora. As fotos aparecem assim que a internet voltar.'
        : phase === 'warmup'
      ? 'O Look da Confra abre no dia da festa, às 7h. Já vai separando a roupa!'
      : phase === 'look'
        ? 'Ninguém postou o look ainda. Toca no botão e seja a primeira pessoa!'
        : showWall === 'look'
          ? looksOpen
            ? `Ainda dá tempo! Os looks ficam abertos até ${clock(LOOK_CLOSES)}.`
            : 'Ninguém postou look dessa vez.'
          : 'Nenhuma foto ainda. Toca no botão e abre os trabalhos.'

  return (
    <div className="app">
      <PartyScene variant="ambient" />

      <header className="topbar">
        <Logo small />
        <span className="topbar-count">{wallPhotos.length} {showWall === 'look' ? (wallPhotos.length === 1 ? 'look' : 'looks') : wallPhotos.length === 1 ? 'foto' : 'fotos'}</span>
      </header>
      <PhaseBar phase={phase} now={t} test={testClock} />

      <main>
        {tab === 'feed' && (
          <Feed
            key={showWall}
            photos={wallPhotos}
            onReact={party.react}
            onRetry={party.retry}
            onOpen={setOpen}
            empty={empty}
            header={
              phase === 'party' || phase === 'after' ? (
                <div className="segmented wall-toggle" role="tablist" aria-label="Mural">
                  <button role="tab" aria-selected={wall === 'party'} onClick={() => setWall('party')}>Festa</button>
                  <button role="tab" aria-selected={wall === 'look'} onClick={() => setWall('look')}>Looks</button>
                </div>
              ) : undefined
            }
          />
        )}
        {tab === 'missions' && <Missions missions={exampleMissions} onShoot={shoot} locked={phase !== 'party'} phase={phase} />}
        {tab === 'ranking' && <Ranking points={examplePoints} appearances={exampleAppearances} looks={bestLooks} />}
        {tab === 'me' && (
          <Profile
            guest={guest}
            myPhotos={myPhotos}
            points={0}
            onLeave={() => {
              try { localStorage.removeItem(GUEST_KEY) } catch { /* ignore */ }
              void leave()
              setGuest(null)
            }}
          />
        )}
      </main>

      <nav className="tabbar">
        <button aria-current={tab === 'feed'} onClick={() => setTab('feed')}>Feed</button>
        <button aria-current={tab === 'missions'} onClick={() => setTab('missions')}>Missões</button>
        <button className="shutter" onClick={shoot} disabled={!canShoot} aria-label={shootKind === 'look' ? 'Postar meu look' : 'Tirar foto'}><span /></button>
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

      {shot && <Develop key={shot.name + shot.lastModified} file={shot} postLabel={shootKind === 'look' ? 'Postar meu look' : 'Postar no feed'} onPost={post} onDiscard={() => setShot(null)} />}
      {open && <Viewer photo={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
