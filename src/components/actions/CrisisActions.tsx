import { Minus, Plus, Scale, Send } from 'lucide-react'
import { useState } from 'react'
import { getCrisis } from '../../game/data'
import { getContributionTotals } from '../../game/engine'
import { resourceLabel } from '../../game/labels'
import type { Commitment, ContributionKey } from '../../game/types'
import { ResourceMark } from '../ResourceMark'
import type { PhaseActionsProps } from './types'

export function CrisisActions({ state, onAction }: PhaseActionsProps) {
  const country = state.activeCountry
  const crisis = getCrisis(state.currentCrisisId)
  const requirements = crisis.requirements(state.playerCount)
  const totals = getContributionTotals(state)
  const [commitment, setCommitment] = useState<Commitment>({})

  const setAmount = (key: ContributionKey, rawAmount: number) => {
    const stock =
      key === 'military' ? state.countries[country].military - 1 : state.countries[country].resources[key]
    const amount = Math.max(0, Math.min(stock, rawAmount))
    setCommitment((current) => ({ ...current, [key]: amount }))
  }

  const fairShare = () => {
    const next: Commitment = {}
    const pending = state.countryOrder.filter((candidate) => !state.commitments[candidate]).length
    for (const [key, requirement] of Object.entries(requirements) as [ContributionKey, number][]) {
      const remaining = Math.max(0, requirement - (totals[key] ?? 0))
      const stock =
        key === 'military' ? state.countries[country].military - 1 : state.countries[country].resources[key]
      next[key] = Math.min(stock, Math.ceil(remaining / pending))
    }
    setCommitment(next)
  }

  const units = Object.values(commitment).reduce((sum, amount) => sum + amount, 0)
  return (
    <div className="action-layout crisis-actions">
      <div className="action-intro">
        <p className="section-label">II · Crisis council</p>
        <h2>Seal your commitment</h2>
        <p>
          Committed resources are spent whether the table succeeds or fails. Other countries see the running total,
          not who gave what.
        </p>
        <button type="button" className="text-button" onClick={fairShare}>
          <Scale size={14} /> Suggest a fair share
        </button>
      </div>
      <div className="commitment-sliders">
        {(Object.entries(requirements) as [ContributionKey, number][]).map(([key, requirement]) => {
          const amount = commitment[key] ?? 0
          const stock =
            key === 'military' ? state.countries[country].military : state.countries[country].resources[key]
          const short = Math.max(0, requirement - (totals[key] ?? 0))
          return (
            <div className="commitment-row" key={key}>
              <ResourceMark resource={key} />
              <span className="commitment-need">
                Table needs <strong>{short}</strong> more
              </span>
              <div className="stepper">
                <button
                  type="button"
                  onClick={() => setAmount(key, amount - 1)}
                  disabled={amount <= 0}
                  aria-label={`Commit less ${resourceLabel(key)}`}
                >
                  <Minus size={15} />
                </button>
                <strong>{amount}</strong>
                <button
                  type="button"
                  onClick={() => setAmount(key, amount + 1)}
                  disabled={amount >= stock || (key === 'military' && amount >= stock - 1)}
                  aria-label={`Commit more ${resourceLabel(key)}`}
                >
                  <Plus size={15} />
                </button>
              </div>
              <small>{stock} held</small>
            </div>
          )
        })}
      </div>
      <div className="action-confirm">
        <div className="sealed-total">
          <span>Your sealed contribution</span>
          <strong>
            {units} {units === 1 ? 'unit' : 'units'}
          </strong>
        </div>
        <button
          type="button"
          className="button-primary action-button"
          onClick={() => onAction({ type: 'SUBMIT_COMMITMENT', country, commitment })}
        >
          <Send size={16} /> Seal commitment
        </button>
        <p className="fine-print">A zero commitment is legal. Trust may fall if others carry the crisis.</p>
      </div>
    </div>
  )
}
