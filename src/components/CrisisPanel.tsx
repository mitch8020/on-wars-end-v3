import { Radio, TriangleAlert } from 'lucide-react'
import { getCrisis } from '../game/data'
import { getContributionTotals } from '../game/engine'
import type { ContributionKey, GameState } from '../game/types'
import { resourceLabel } from '../game/labels'
import { ResourceMark } from './ResourceMark'

export function CrisisPanel({ state }: { state: GameState }) {
  const crisis = getCrisis(state.currentCrisisId)
  const requirements = crisis.requirements(state.playerCount)
  const totals = getContributionTotals(state)
  return (
    <aside className="crisis-panel" aria-labelledby="crisis-title">
      <div className="panel-heading">
        <div>
          <p className="section-label"><Radio size={12} aria-hidden="true" /> Round {state.round} dispatch</p>
          <h2 id="crisis-title">{crisis.title}</h2>
        </div>
        <TriangleAlert className="crisis-alert" aria-hidden="true" />
      </div>
      <p className="crisis-location">{crisis.location}</p>
      <p className="crisis-brief">{crisis.briefing}</p>
      <div className="crisis-demands">
        <p>Collective requirement</p>
        {(Object.entries(requirements) as [ContributionKey, number][]).map(([key, requirement]) => {
          const current = totals[key] ?? 0
          return (
            <div className="demand-row" key={key}>
              <ResourceMark resource={key} compact />
              <span>{resourceLabel(key)}</span>
              <div className="demand-pips" aria-label={`${current} of ${requirement} ${resourceLabel(key)} committed`}>
                {Array.from({ length: requirement }, (_, index) => <i key={index} className={index < current ? 'filled' : ''} />)}
              </div>
              <strong>{current}/{requirement}</strong>
            </div>
          )
        })}
      </div>
      <div className="crisis-stakes">
        <div><span>If met</span><strong>Peace +{crisis.success.peace} · Unrest {crisis.success.unrest}</strong></div>
        <div><span>If missed</span><strong>Peace {crisis.failure.peace} · Unrest +{crisis.failure.unrest}</strong></div>
      </div>
    </aside>
  )
}
