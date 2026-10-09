import { useState } from 'react'
import type { RankEntry } from '../lib/types'
import CountUp from './bits/CountUp'

interface Props {
  points: RankEntry[]
  appearances: RankEntry[]
}

export function Ranking({ points, appearances }: Props) {
  const [tab, setTab] = useState<'pts' | 'faces'>('pts')
  const list = tab === 'pts' ? points : appearances
  const unit = tab === 'pts' ? 'pts' : 'fotos'
  const top = list[0]?.value || 1
  return (
    <div className="page">
      <h2 className="page-title">Ranking</h2>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={tab === 'pts'} onClick={() => setTab('pts')}>Missões</button>
        <button role="tab" aria-selected={tab === 'faces'} onClick={() => setTab('faces')}>Quem mais apareceu</button>
      </div>
      <ol className="ranking">
        {list.map((e, i) => (
          <li key={e.name} className={i < 3 ? `podium p${i + 1}` : undefined}>
            <span className="rank-pos">{i + 1}</span>
            <span className="rank-name">{e.name}</span>
            <span className="rank-bar"><span style={{ width: `${(e.value / top) * 100}%` }} /></span>
            <span className="rank-val"><CountUp key={tab + e.name} to={e.value} /> {unit}</span>
          </li>
        ))}
      </ol>
      <p className="page-note">Dados de exemplo até o app ser ligado ao servidor.</p>
    </div>
  )
}
