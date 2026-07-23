import { Check, ChevronRight, CircleOff } from 'lucide-react'
import type { ContributionKey } from '../../game/types'
import { ResourceMark } from '../ResourceMark'
import type { PhaseActionsProps } from './types'

export function AftermathActions({ state, onAction }: PhaseActionsProps) {
  const result = state.lastCrisisResult
  if (!result) return null
  return (
    <div className={`round-aftermath ${result.succeeded ? 'success' : 'failure'}`}>
      <span className="aftermath-mark">{result.succeeded ? <Check /> : <CircleOff />}</span>
      <div>
        <p className="section-label">Round {state.round} communiqué</p>
        <h2>{result.headline}</h2>
        <p>{result.detail}</p>
      </div>
      <div className="aftermath-totals">
        {(Object.entries(result.requirements) as [ContributionKey, number][]).map(([key, required]) => (
          <span key={key}>
            <ResourceMark resource={key} compact />
            <strong>
              {result.totals[key] ?? 0}/{required}
            </strong>
          </span>
        ))}
      </div>
      <button
        type="button"
        className="button-primary action-button"
        onClick={() => onAction({ type: 'CONTINUE_ROUND' })}
      >
        {state.round === state.maxRounds ? 'Read the final outcome' : `Begin round ${state.round + 1}`}{' '}
        <ChevronRight size={17} />
      </button>
    </div>
  )
}
