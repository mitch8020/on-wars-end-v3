import { ChevronRight, Landmark } from 'lucide-react'
import { useState } from 'react'
import { COUNTRY_DEFINITIONS, getPolicy } from '../../game/data'
import { canPlayPolicy } from '../../game/engine'
import type { CountryId } from '../../game/types'
import type { PhaseActionsProps } from './types'

export function CabinetActions({ state, onAction }: PhaseActionsProps) {
  const country = state.activeCountry
  const [selected, setSelected] = useState(state.countries[country].policyHand[0] ?? '')
  const [target, setTarget] = useState<CountryId | undefined>()
  const policy = selected ? getPolicy(selected) : null
  const legal = policy
    ? canPlayPolicy(state, country, policy.id, policy.requiresTarget ? target : undefined)
    : 'Choose a policy.'

  return (
    <div className="action-layout cabinet-actions">
      <div className="action-intro">
        <p className="section-label">I · Cabinet</p>
        <h2>Choose one national policy</h2>
        <p>
          Build your position, help a neighbor, or ease the pressure. You will commit to the crisis after every
          cabinet acts.
        </p>
        <button
          className="text-button"
          type="button"
          onClick={() => onAction({ type: 'CONSERVE_RESOURCES', country })}
        >
          <Landmark size={14} /> Conserve instead · gain 1 Capital
        </button>
      </div>
      <div className="policy-hand">
        {state.countries[country].policyHand.map((cardId) => {
          const card = getPolicy(cardId)
          const isSelected = cardId === selected
          const cardLegal = canPlayPolicy(
            state,
            country,
            cardId,
            card.requiresTarget ? state.countryOrder.find((candidate) => candidate !== country) : undefined,
          )
          return (
            <button
              type="button"
              key={cardId}
              className={`policy-card ${isSelected ? 'selected' : ''} ${cardLegal !== true ? 'unaffordable' : ''}`}
              onClick={() => {
                setSelected(cardId)
                setTarget(undefined)
              }}
              aria-pressed={isSelected}
            >
              <span className="policy-kicker">{card.kicker}</span>
              <strong>{card.title}</strong>
              <p>{card.description}</p>
              <span className="policy-index">
                {String(state.countries[country].policyHand.indexOf(cardId) + 1).padStart(2, '0')}
              </span>
            </button>
          )
        })}
      </div>
      <div className="action-confirm">
        {policy?.requiresTarget && (
          <div className="target-picker">
            <span>Choose a partner</span>
            <div>
              {state.countryOrder
                .filter((candidate) => candidate !== country)
                .map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    className={target === candidate ? 'selected' : ''}
                    onClick={() => setTarget(candidate)}
                  >
                    <span style={{ background: COUNTRY_DEFINITIONS[candidate].color }}>
                      {COUNTRY_DEFINITIONS[candidate].monogram}
                    </span>
                    {COUNTRY_DEFINITIONS[candidate].name}
                  </button>
                ))}
            </div>
          </div>
        )}
        <button
          type="button"
          className="button-primary action-button"
          disabled={legal !== true || !policy}
          title={legal === true ? undefined : legal}
          onClick={() =>
            policy &&
            onAction({
              type: 'PLAY_POLICY',
              country,
              cardId: policy.id,
              target: policy.requiresTarget ? target : undefined,
            })
          }
        >
          Enact {policy?.title ?? 'policy'} <ChevronRight size={17} />
        </button>
        {legal !== true && <p className="action-error">{legal}</p>}
      </div>
    </div>
  )
}
