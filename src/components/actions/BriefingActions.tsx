import { ChevronRight } from 'lucide-react'
import { COUNTRY_DEFINITIONS, getCrisis } from '../../game/data'
import type { PhaseActionsProps } from './types'

export function BriefingActions({ state, onAction }: PhaseActionsProps) {
  const crisis = getCrisis(state.currentCrisisId)
  return (
    <div className="phase-briefing">
      <div className="briefing-round">
        <span>ROUND</span>
        <strong>{String(state.round).padStart(2, '0')}</strong>
        <small>OF {state.maxRounds}</small>
      </div>
      <div className="briefing-copy">
        <p className="section-label">Incoming dispatch · {crisis.location}</p>
        <h2>{crisis.title}</h2>
        <p>{crisis.briefing}</p>
      </div>
      <div className="briefing-chair">
        <span>Chair this round</span>
        <strong>{COUNTRY_DEFINITIONS[state.firstPlayer].name}</strong>
        <small>Cabinet → crisis → summit</small>
      </div>
      <button
        type="button"
        className="button-primary action-button"
        onClick={() => onAction({ type: 'ACKNOWLEDGE_BRIEFING' })}
      >
        Open cabinet <ChevronRight size={18} />
      </button>
    </div>
  )
}
