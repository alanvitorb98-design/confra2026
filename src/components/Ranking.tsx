import { useState } from 'react'
import type { RankEntry } from '../lib/types'
import CountUp from './bits/CountUp'

interface Props {
  points: RankEntry[]
  appearances: RankEntry[]
  /** best outfit by reactions, once the outfit wall has entries */
  looks: RankEntry[]
}

export function Ranking({ points, appearances, looks }: Props) {
  const [tab, setTab] = useState<'pts' | 'faces' | 'looks'>('pts')
  const list = tab === 'pts' ? points : tab === 'faces' ? appearances : looks
  const unit = tab === 'pts' ? 'pts' : tab === 'faces' ? 'fotos' : 'reações'
  const top = list[0]?.value || 1
  return (
    <div className="page">
      <h2 className="page-title">Ranking</h2>
      <div className={`segmented${looks.length ? ' three' : ''}`} role="tablist">
        <button role="tab" aria-selected={tab === 'pts'} onClick={() => setTab('pts')}>Missões</button>
        <button role="tab" aria-selected={tab === 'faces'} onClick={() => setTab('faces')}>{looks.length ? 'Aparições' : 'Quem mais apareceu'}</button>
        {looks.length > 0 && <button role="tab" aria-selected={tab === 'looks'} onClick={() => setTab('looks')}>Melhor look</button>}
      </div>
      <ol className="ranking">
        {list.map((e, i) => (
          <li key={e.name} className={i < 3 ? `podium p${i + 1}` : undefined}>
            <span className="rank-pos">{i + 1}</span>
            <span className="rank-name">{e.name}</span>
            <span className="rank-bar"><span style={{ width: `${(e.value / top) * 100}%` }} /></span>
            <span className="rank-val"><CountUp key={tab + e.name} to={e.value} /> {e.value === 1 ? unit.replace(/s$/, '').replace('reaçõe', 'reação') : unit}</span>
          </li>
        ))}
      </ol>
      {list.length === 0 && (
        <p className="page-note">
          {tab === 'pts' ? 'Ninguém pontuou ainda. As missões começam junto com a festa.' : tab === 'faces' ? 'Esse ranking chega com o reconhecimento de rosto.' : 'Nenhum look ainda.'}
        </p>
      )}
    </div>
  )
}
