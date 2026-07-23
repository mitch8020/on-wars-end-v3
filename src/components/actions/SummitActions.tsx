import { ArrowRightLeft, BookOpen, Check, Handshake } from 'lucide-react'
import { useState } from 'react'
import { getSigningStatus } from '../../game/engine'
import type { CountryId, Resource } from '../../game/types'
import { AccordOverview } from './summit/AccordOverview'
import { BackchannelBuilder } from './summit/BackchannelBuilder'
import { ExchangeBuilder } from './summit/ExchangeBuilder'
import type { PhaseActionsProps } from './types'

type SummitMode = 'overview' | 'exchange' | 'backchannel'

export function SummitActions({ state, onAction }: PhaseActionsProps) {
  const country = state.activeCountry
  const signing = getSigningStatus(state, country)
  const [mode, setMode] = useState<SummitMode>('overview')
  const [give, setGive] = useState<Resource>('food')
  const [want, setWant] = useState<Resource>('fuel')
  const [target, setTarget] = useState<CountryId>(
    state.countryOrder.find((candidate) => candidate !== country) ?? country,
  )
  const canPost = give !== want && state.countries[country].resources[give] > 0

  return (
    <div className="action-layout summit-actions">
      <div className="action-intro">
        <p className="section-label">III · Peace summit</p>
        <h2>Make one diplomatic move</h2>
        <p>
          Sign if your coalition is ready, accept a proposal, post a one-for-one exchange, or spend Capital on a
          backchannel.
        </p>
        <div className="summit-tabs">
          <button
            type="button"
            className={mode === 'overview' ? 'selected' : ''}
            onClick={() => setMode('overview')}
          >
            <Handshake size={14} /> Accord
          </button>
          <button
            type="button"
            className={mode === 'exchange' ? 'selected' : ''}
            onClick={() => setMode('exchange')}
          >
            <ArrowRightLeft size={14} /> Exchange
          </button>
          <button
            type="button"
            className={mode === 'backchannel' ? 'selected' : ''}
            onClick={() => setMode('backchannel')}
          >
            <BookOpen size={14} /> Backchannel
          </button>
        </div>
      </div>

      <div className="summit-workspace">
        {mode === 'overview' && (
          <AccordOverview
            state={state}
            country={country}
            signing={signing}
            onAccept={(offerCountry) =>
              onAction({ type: 'ACCEPT_OFFER', country, offerCountry })
            }
          />
        )}
        {mode === 'exchange' && (
          <ExchangeBuilder
            state={state}
            country={country}
            give={give}
            want={want}
            onGiveChange={setGive}
            onWantChange={setWant}
          />
        )}
        {mode === 'backchannel' && (
          <BackchannelBuilder
            state={state}
            country={country}
            target={target}
            onTargetChange={setTarget}
          />
        )}
      </div>

      <div className="action-confirm">
        {mode === 'overview' && (
          <button
            type="button"
            className="button-primary action-button"
            disabled={!signing.eligible}
            onClick={() => onAction({ type: 'SIGN_TREATY', country })}
          >
            <Check size={17} /> Sign the Vellan Accord
          </button>
        )}
        {mode === 'exchange' && (
          <button
            type="button"
            className="button-primary action-button"
            disabled={!canPost}
            onClick={() => onAction({ type: 'POST_OFFER', country, give, want })}
          >
            <ArrowRightLeft size={16} /> Post proposal
          </button>
        )}
        {mode === 'backchannel' && (
          <button
            type="button"
            className="button-primary action-button"
            disabled={state.countries[country].resources.capital < 1 || target === country}
            onClick={() => onAction({ type: 'BUILD_TRUST', country, target })}
          >
            <BookOpen size={16} /> Open backchannel
          </button>
        )}
        <button
          type="button"
          className="button-pass"
          onClick={() => onAction({ type: 'PASS_SUMMIT', country })}
        >
          Pass this summit move
        </button>
      </div>
    </div>
  )
}
