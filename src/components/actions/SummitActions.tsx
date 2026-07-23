import {
  ArrowRightLeft,
  BookOpen,
  Check,
  CircleOff,
  Handshake,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { COUNTRY_DEFINITIONS, RESOURCE_META } from '../../game/data'
import { getSigningStatus, getTrust } from '../../game/engine'
import { RESOURCES, type CountryId, type Resource } from '../../game/types'
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

  const availableOffers = state.countryOrder
    .map((candidate) => state.summitOffers[candidate])
    .filter((offer) => offer && offer.country !== country)
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
          <div className="accord-overview">
            <div className={`signing-status ${signing.eligible ? 'ready' : ''}`}>
              <span className="accord-seal">{signing.eligible ? <Sparkles /> : <CircleOff />}</span>
              <div>
                <strong>
                  {signing.eligible ? 'Your delegation can sign' : 'Your delegation is not ready'}
                </strong>
                {signing.eligible ? (
                  <p>The mandate, red line, Peace, and Trust requirements are all met.</p>
                ) : (
                  <ul>
                    {signing.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {availableOffers.length > 0 && (
              <div className="proposal-list">
                <span>Proposals on the table</span>
                {availableOffers.map(
                  (offer) =>
                    offer && (
                      <button
                        type="button"
                        key={offer.country}
                        disabled={state.countries[country].resources[offer.want] < 1}
                        onClick={() =>
                          onAction({ type: 'ACCEPT_OFFER', country, offerCountry: offer.country })
                        }
                      >
                        <span className="proposal-country">{COUNTRY_DEFINITIONS[offer.country].monogram}</span>
                        <strong>{COUNTRY_DEFINITIONS[offer.country].name}</strong>
                        <span>
                          gives <b>{RESOURCE_META[offer.give].label}</b>
                        </span>
                        <ArrowRightLeft size={14} />
                        <span>
                          wants <b>{RESOURCE_META[offer.want].label}</b>
                        </span>
                        <em>Accept</em>
                      </button>
                    ),
                )}
              </div>
            )}
          </div>
        )}
        {mode === 'exchange' && (
          <div className="exchange-builder">
            <p>Post a public one-for-one proposal. It stays open until accepted or the round ends.</p>
            <div className="exchange-sides">
              <label>
                <span>You give</span>
                <select value={give} onChange={(event) => setGive(event.target.value as Resource)}>
                  {RESOURCES.map((resource) => (
                    <option key={resource} value={resource}>
                      {RESOURCE_META[resource].label} · {state.countries[country].resources[resource]} held
                    </option>
                  ))}
                </select>
              </label>
              <ArrowRightLeft aria-hidden="true" />
              <label>
                <span>You request</span>
                <select value={want} onChange={(event) => setWant(event.target.value as Resource)}>
                  {RESOURCES.map((resource) => (
                    <option key={resource} value={resource}>
                      {RESOURCE_META[resource].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}
        {mode === 'backchannel' && (
          <div className="backchannel-builder">
            <p>Spend 1 Capital to build 2 Trust, reveal a country’s mandate, and gain 1 Peace Momentum.</p>
            <div className="partner-grid">
              {state.countryOrder
                .filter((candidate) => candidate !== country)
                .map((candidate) => (
                  <button
                    type="button"
                    key={candidate}
                    className={target === candidate ? 'selected' : ''}
                    onClick={() => setTarget(candidate)}
                  >
                    <span style={{ background: COUNTRY_DEFINITIONS[candidate].color }}>
                      {COUNTRY_DEFINITIONS[candidate].monogram}
                    </span>
                    <strong>{COUNTRY_DEFINITIONS[candidate].name}</strong>
                    <small>Trust {getTrust(state, country, candidate)}/4</small>
                  </button>
                ))}
            </div>
          </div>
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
