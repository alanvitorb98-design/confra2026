import type { Mission, Photo, RankEntry } from './types'

// Example content so the app opens in a realistic state until the backend is wired.

const party = (a: string, b: string, c: string) =>
  [
    `radial-gradient(circle at 18% 22%, ${a} 0 5%, transparent 6%)`,
    `radial-gradient(circle at 80% 16%, ${b} 0 4%, transparent 5%)`,
    `radial-gradient(circle at 64% 40%, #fff6 0 2%, transparent 3%)`,
    `radial-gradient(ellipse at 34% 70%, #2a1d26 0 22%, transparent 23%)`,
    `radial-gradient(ellipse at 34% 46%, #8a6253 0 11%, transparent 12%)`,
    `radial-gradient(ellipse at 70% 74%, #1f1820 0 24%, transparent 25%)`,
    `radial-gradient(ellipse at 70% 50%, #a07560 0 10%, transparent 11%)`,
    `linear-gradient(170deg, ${c}, #140c1c)`,
  ].join(',')

const zero = () => ({ '🔥': 0, '😂': 0, '😍': 0, '🥂': 0 })

export const examplePhotos: Photo[] = [
  {
    id: 'ex1',
    author: 'Marina',
    caption: 'a mesa do RH dominou a pista',
    placeholder: party('#ffd23f', '#fff1c4', '#6b4a24'),
    takenAt: new Date('2026-11-07T21:42:00'),
    reactions: { ...zero(), '🔥': 14, '🥂': 6 },
    mine: {},
    tilt: -2,
    frame: 'classic',
  },
  {
    id: 'ex2',
    author: 'Rodrigo',
    caption: 'amigo oculto mais caótico da história',
    placeholder: party('#f6d77c', '#ffffff', '#3d2c1c'),
    takenAt: new Date('2026-11-07T21:15:00'),
    reactions: { ...zero(), '😂': 22, '😍': 3 },
    mine: {},
    tilt: 1.5,
    frame: 'dark',
  },
  {
    id: 'ex3',
    author: 'Patrícia',
    caption: 'missão cumprida com o pessoal do Financeiro',
    placeholder: party('#ffe9a8', '#d9a52b', '#5a3328'),
    takenAt: new Date('2026-11-07T20:58:00'),
    reactions: { ...zero(), '😍': 9, '🔥': 4 },
    mine: {},
    tilt: -1,
    frame: 'gold',
  },
]

export const exampleMissions: Mission[] = [
  { id: 'm1', title: 'Foto com alguém do Financeiro', points: 30, done: false },
  { id: 'm2', title: 'Selfie com 5 pessoas ou mais', points: 50, done: false },
  { id: 'm3', title: 'Foto com quem entrou na empresa este ano', points: 40, done: false },
  { id: 'm4', title: 'Flagra na pista de dança', points: 20, done: true },
]

export const examplePoints: RankEntry[] = [
  { name: 'Marina', value: 180 },
  { name: 'Rodrigo', value: 150 },
  { name: 'Patrícia', value: 120 },
  { name: 'Lucas', value: 90 },
  { name: 'Beatriz', value: 70 },
]

export const exampleAppearances: RankEntry[] = [
  { name: 'Marina', value: 23 },
  { name: 'Rodrigo', value: 19 },
  { name: 'Patrícia', value: 17 },
  { name: 'Beatriz', value: 12 },
  { name: 'Lucas', value: 9 },
]
