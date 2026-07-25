import { ChevronRight, Landmark } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { COUNTRY_DEFINITIONS, getPolicy } from '../../game/data'
import { canPlayPolicy } from '../../game/engine'
import { resourceLabel } from '../../game/labels'
import type { CountryId, Resource } from '../../game/types'
import type { PhaseActionsProps } from './types'

export function CabinetActions({ state, onAction }: PhaseActionsProps) {
  const country = state.activeCountry
  const reduceMotion = useReducedMotion()
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
        <p>Lift a card to inspect it. Your other policies return to the diplomatic case when you act.</p>
        <button
          className="text-button"
          type="button"
          onClick={() => onAction({ type: 'CONSERVE_RESOURCES', country })}
        >
          <Landmark size={14} /> Conserve instead · gain 1 Capital
        </button>
      </div>
      <div className="policy-hand physical-hand" role="list" aria-label="Policy hand">
        <div className="policy-deck" aria-hidden="true">
          <span />
          <small>Policy<br />reserve</small>
        </div>
        {state.countries[country].policyHand.map((cardId, index) => {
          const card = getPolicy(cardId)
          const isSelected = cardId === selected
          const cardLegal = canPlayPolicy(
            state,
            country,
            cardId,
            card.requiresTarget ? state.countryOrder.find((candidate) => candidate !== country) : undefined,
          )
          return (
            <motion.button
              type="button"
              key={cardId}
              className={`policy-card ${isSelected ? 'selected' : ''} ${cardLegal !== true ? 'unaffordable' : ''}`}
              onClick={() => {
                setSelected(cardId)
                setTarget(undefined)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
                event.preventDefault()
                const cards = state.countries[country].policyHand
                const direction = event.key === 'ArrowRight' ? 1 : -1
                const nextIndex = (index + direction + cards.length) % cards.length
                setSelected(cards[nextIndex])
                setTarget(undefined)
                const buttons =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('.policy-card')
                buttons?.[nextIndex]?.focus()
              }}
              aria-pressed={isSelected}
              aria-label={`${card.title}. ${card.description}`}
              tabIndex={isSelected ? 0 : -1}
              style={{ '--deal-index': index } as React.CSSProperties}
              initial={
                reduceMotion
                  ? false
                  : { opacity: 0, x: 190 - index * 26, y: 74, rotate: 10, scale: 0.78 }
              }
              animate={{
                opacity: 1,
                x: 0,
                y: isSelected ? -18 : 0,
                rotate: isSelected ? 0 : (index - 1) * 5.5,
                scale: isSelected ? 1.035 : 1,
                zIndex: isSelected ? 5 : index + 1,
              }}
              transition={{
                delay: reduceMotion ? 0 : index * 0.13,
                type: reduceMotion ? 'tween' : 'spring',
                stiffness: 230,
                damping: 22,
              }}
            >
              <span className="policy-card-back" aria-hidden="true">
                <i>III</i>
                <b>On War’s End</b>
                <small>Cabinet memorandum</small>
              </span>
              <span className="policy-card-face">
                <span className="policy-kicker">{card.kicker}</span>
                <strong>{card.title}</strong>
                <p>{card.description}</p>
                <span className="card-ledger" aria-hidden="true">
                  {card.cost && (
                    <small>
                      Pay{' '}
                      {Object.entries(card.cost)
                        .map(([resource, value]) => `${value} ${resourceLabel(resource as Resource)}`)
                        .join(' · ')}
                    </small>
                  )}
                  {card.gain && (
                    <small>
                      Gain{' '}
                      {Object.entries(card.gain)
                        .map(([resource, value]) => `${value} ${resourceLabel(resource as Resource)}`)
                        .join(' · ')}
                    </small>
                  )}
                </span>
                <span className="policy-index">{String(index + 1).padStart(2, '0')}</span>
              </span>
            </motion.button>
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
