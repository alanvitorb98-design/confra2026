import type { Mission, RankEntry } from './types'

// Example content for the parts that start with the party: missions and the face-count ranking.

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
