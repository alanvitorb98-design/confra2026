import { AnimatePresence } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Develop } from './components/Develop'
import { Feed } from './components/Feed'
import { Missions } from './components/Missions'
import { Profile } from './components/Profile'
import { Ranking } from './components/Ranking'
import { Viewer } from './components/Viewer'
import { Welcome } from './components/Welcome'
import { AdminPanel } from './components/AdminPanel'
import { Telao } from './components/Telao'
import { TabIcon } from './components/Icons'
import { Shutter } from './components/Shutter'
import { amAdmin, claimAdmin, comeBack, eventCode, hasSession, join, leave, loadEvent, sendSelfie, useParty } from './lib/backend'
import { playShutter } from './lib/sound'
import { healPush } from './lib/push'
import type { Frame, Guest, Photo, Wall } from './lib/types'
import { Countdown } from './components/Countdown'
import { PhaseBar } from './components/PhaseBar'
import { LOOK_CLOSES, clock, lookOpen, phaseAt, setTestClock, testClock, useNow } from './lib/event'
import { Install } from './components/Install'
import { isInstalled } from './lib/install'
import { Splash } from './components/Splash'
import { Logo } from './components/Logo'
import { PartyScene } from './components/PartyScene'

type Tab = 'feed' | 'missions' | 'ranking' | 'me'

const GUEST_KEY = 'confra26.guest'
const ORG_KEY = 'confra26.org'

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
  const gallery = useRef<HTMLInputElement>(null)
  const [code] = useState(eventCode)
  const [intro, setIntro] = useState(true)
  const [gate, setGate] = useState(() => !isInstalled())
  const t = useNow()
  const phase = phaseAt(t)
  // an organizer code typed on the countdown lets this phone in early (checked by the server on sign-in)
  const [orgCode, setOrgCode] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ORG_KEY)
    } catch {
      return null
    }
  })
  const early = phase === 'countdown' && !!orgCode
  const party = useParty(guest && (phase !== 'countdown' || early) ? guest : null, phase === 'party')
  const photos = party.photos
  const [, setConfigLoaded] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [panel, setPanel] = useState(false)
  const [telao, setTelao] = useState(false)
  const closeTelao = useCallback(() => setTelao(false), [])
  // which mission the photo being taken is for
  const [missionShot, setMissionShot] = useState<string>()

  // the organizer's dates and place
  // daily reminders: re-register this phone if the push service dropped it
  useEffect(() => {
    healPush()
  }, [])

  useEffect(() => {
    loadEvent(code).then((ok) => ok && setConfigLoaded((n) => n + 1))
  }, [code])

  useEffect(() => {
    if (!guest) return setIsAdmin(false)
    amAdmin().then(async (yes) => {
      if (!yes && orgCode) yes = await claimAdmin(orgCode).catch(() => false)
      setIsAdmin(yes)
      // a wrong organizer code sends this phone back to the countdown
      if (!yes && orgCode) forgetOrg()
      // the test clock is for organizers: anyone else stays on the real time
      if (!yes && testClock) {
        setTestClock(null)
        location.reload()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest, orgCode])

  const forgetOrg = () => {
    try {
      localStorage.removeItem(ORG_KEY)
    } catch {
      /* private mode */
    }
    setOrgCode(null)
  }

  // the browser can clear the login: then the guest signs in again
  useEffect(() => {
    if (guest) hasSession().then((ok) => !ok && setGuest(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!guest) return
    // ask the phone not to clear the app's data (and with it the login) on its own
    navigator.storage?.persist?.().catch(() => undefined)
    try {
      // the selfie object URL dies with the page, so only the profile text is kept
      localStorage.setItem(GUEST_KEY, JSON.stringify({ ...guest, selfieUrl: undefined }))
    } catch {
      /* private mode: the guest simply signs in again next time */
    }
  }, [guest])

  if (gate) return <Install onSkip={() => setGate(false)} />
  if (intro)
    return (
      <AnimatePresence>
        <Splash key="splash" onDone={() => setIntro(false)} />
      </AnimatePresence>
    )
  if (phase === 'countdown' && !early)
    return (
      <Countdown
        onOrganizer={(c) => {
          try {
            localStorage.setItem(ORG_KEY, c)
          } catch {
            /* private mode: works until the page closes */
          }
          setOrgCode(c)
        }}
      />
    )
  if (!guest) return (
      <Welcome
        code={code}
        onBack={async (c) => setGuest(await comeBack(c))}
        onEnter={async (c, g) => {
          const me = await join(c, g)
          setGuest(me)
          // face matching is opt-in: the selfie goes up only for those who said yes
          if (g.faceOptIn && g.selfieUrl) {
            fetch(g.selfieUrl)
              .then((res) => res.blob())
              .then((b) => sendSelfie(me.id, b))
              .catch(() => undefined)
          }
        }}
      />
    )

  // before the party only the outfit wall exists; afterwards both, party first
  const showWall: Wall = phase === 'warmup' || phase === 'look' ? 'look' : wall
  const canShoot = phase === 'look' || phase === 'party'
  // while the outfit wall overlaps the party, the shutter posts to the wall on screen
  const looksOpen = lookOpen(t)
  const shootKind: Wall = phase === 'look' || (looksOpen && showWall === 'look' && tab === 'feed') ? 'look' : 'party'

  const go = (next: Tab) => {
    setPanel(false)
    setTab(next)
  }

  const shoot = (missionId?: string, fromGallery = false) => {
    if (!canShoot) return
    setMissionShot(phase === 'party' ? missionId : undefined)
    ;(fromGallery ? gallery : camera).current?.click()
  }

  const post = (caption: string, frame: Frame, preview: string) => {
    if (!shot) return
    // the untouched original File goes up as is: no resizing or recompression anywhere
    party.post(shot, preview, shootKind, caption, frame, missionShot)
    setMissionShot(undefined)
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

  if (telao && isAdmin) return <Telao photos={photos} onClose={closeTelao} />

  return (
    <div className="app">
      <PartyScene variant="ambient" />

      <header className="topbar">
        <Logo small />
        <span className="topbar-count">{wallPhotos.length} {showWall === 'look' ? (wallPhotos.length === 1 ? 'look' : 'looks') : wallPhotos.length === 1 ? 'foto' : 'fotos'}</span>
      </header>
      <PhaseBar phase={phase} now={t} test={testClock} />

      <main>
        {panel && isAdmin ? (
          <AdminPanel missions={party.allMissions} onClose={() => setPanel(false)} onTelao={() => setTelao(true)} />
        ) : (
        <>
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
        {tab === 'missions' && <Missions missions={party.missions} people={party.people} onSwap={party.swapPeople} onShoot={shoot} locked={phase !== 'party'} phase={phase} />}
        {tab === 'ranking' && <Ranking points={party.points} appearances={party.appearances} looks={bestLooks} />}
        {tab === 'me' && (
          <Profile
            guest={guest}
            onGuest={setGuest}
            isAdmin={isAdmin}
            onPanel={() => setPanel(true)}
            onClaim={async (c: string) => {
              const ok = await claimAdmin(c)
              if (ok) setIsAdmin(true)
              return ok
            }}
            myPhotos={myPhotos}
            points={party.points.find((e) => e.name === guest.name)?.value ?? 0}
            onLeave={() => {
              try { localStorage.removeItem(GUEST_KEY) } catch { /* ignore */ }
              void leave()
              setGuest(null)
            }}
          />
        )}
        </>
        )}
      </main>

      <nav className="tabbar">
        <button aria-current={tab === 'feed'} onClick={() => go('feed')}><TabIcon name="feed" active={tab === 'feed'} />Feed</button>
        <button aria-current={tab === 'missions'} onClick={() => go('missions')}><TabIcon name="missions" active={tab === 'missions'} />Missões</button>
        <div className="shoot-slot">
          <Shutter onShoot={() => shoot()} disabled={!canShoot} label={shootKind === 'look' ? 'Postar meu look' : 'Tirar foto'} />
          <button className="gallery-pick" onClick={() => shoot(undefined, true)} disabled={!canShoot} aria-label="Escolher da galeria">
            <svg viewBox="0 0 24 24" aria-hidden>
              <rect x="3.5" y="5" width="12" height="14" rx="1" transform="rotate(-10 9.5 12)" fill="#fffdf7" stroke="var(--ink)" strokeWidth="1.6" />
              <rect x="8" y="5" width="12.5" height="14.5" rx="1" fill="#fffdf7" stroke="var(--ink)" strokeWidth="1.6" />
              <rect x="10" y="7" width="8.5" height="8" fill="var(--gold)" stroke="var(--ink)" strokeWidth="1.2" />
              <path d="M10 13.6l2.6-2.4 2 1.8 1.4-1.2 2.5 2.3" fill="none" stroke="var(--ink)" strokeWidth="1.1" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <button aria-current={tab === 'ranking'} onClick={() => go('ranking')}><TabIcon name="ranking" active={tab === 'ranking'} />Ranking</button>
        <button aria-current={tab === 'me'} onClick={() => go('me')}><TabIcon name="me" active={tab === 'me'} />Eu</button>
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
      <input
        ref={gallery}
        type="file"
        accept="image/*"
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
      {open && (
        <Viewer
          // the live copy: its links and who appears keep updating while it is open
          photo={photos.find((p) => p.id === open.id) ?? open}
          canRemove={open.authorId === guest.id || isAdmin}
          canTag={open.kind === 'party' && (open.authorId === guest.id || isAdmin)}
          me={guest.id}
          guests={party.guests}
          onRemove={async () => {
            await party.hide(open.id)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
