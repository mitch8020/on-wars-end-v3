import { Check, CircleOff, FileText, RotateCcw, X } from 'lucide-react'
import { COUNTRY_DEFINITIONS } from '../../game/data'
import type { GameState } from '../../game/types'

type EndingOverlayProps = {
  state: GameState
  onNewGame: () => void
  onReview: () => void
}

export function EndingOverlay({ state, onNewGame, onReview }: EndingOverlayProps) {
  const ending = state.ending
  if (!ending) return null
  const victory = ending.result === 'victory'
  return (
    <div
      className={`ending-overlay ${victory ? 'victory' : 'defeat'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ending-title"
    >
      <div className="ending-communique">
        <div className="ending-stamp">
          {victory ? <Check /> : <CircleOff />}
          <span>{victory ? 'ACCORD' : 'NO TREATY'}</span>
        </div>
        <p className="section-label">Final communiqué · Dispatch {state.seed}</p>
        <h2 id="ending-title">{ending.title}</h2>
        <p className="ending-reason">{ending.reason}</p>
        <blockquote>{ending.epilogue}</blockquote>
        <div className="ending-signatures">
          {state.countryOrder.map((country) => (
            <span
              key={country}
              className={state.countries[country].signed ? 'signed' : ''}
            >
              {state.countries[country].signed ? <Check size={12} /> : <X size={12} />}
              {COUNTRY_DEFINITIONS[country].name}
            </span>
          ))}
        </div>
        <div className="ending-actions">
          <button type="button" className="button-quiet" onClick={onReview}>
            <FileText size={15} /> Review final table
          </button>
          <button type="button" className="button-primary" onClick={onNewGame}>
            <RotateCcw size={15} /> Convene a new table
          </button>
        </div>
      </div>
    </div>
  )
}
