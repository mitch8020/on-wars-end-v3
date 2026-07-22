import {
  ArrowRightLeft,
  BookOpen,
  Check,
  ChevronRight,
  CircleOff,
  Handshake,
  Landmark,
  Minus,
  Plus,
  Scale,
  Send,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { COUNTRY_DEFINITIONS, RESOURCE_META, getCrisis, getPolicy } from '../game/data'
import { canPlayPolicy, getContributionTotals, getSigningStatus, getTrust } from '../game/engine'
import { RESOURCES, type Commitment, type ContributionKey, type CountryId, type GameAction, type GameState, type Resource } from '../game/types'
import { ResourceMark } from './ResourceMark'
import { resourceLabel } from '../game/labels'

type ActionDockProps = {
  state: GameState
  onAction: (action: GameAction) => void
}

function CabinetActions({ state, onAction }: ActionDockProps) {
  const country = state.activeCountry
  const [selected, setSelected] = useState(state.countries[country].policyHand[0] ?? '')
  const [target, setTarget] = useState<CountryId | undefined>()
  const policy = selected ? getPolicy(selected) : null
  const legal = policy ? canPlayPolicy(state, country, policy.id, policy.requiresTarget ? target : undefined) : 'Choose a policy.'

  return (
    <div className="action-layout cabinet-actions">
      <div className="action-intro">
        <p className="section-label">I · Cabinet</p>
        <h2>Choose one national policy</h2>
        <p>Build your position, help a neighbor, or ease the pressure. You will commit to the crisis after every cabinet acts.</p>
        <button className="text-button" type="button" onClick={() => onAction({ type: 'CONSERVE_RESOURCES', country })}>
          <Landmark size={14} /> Conserve instead · gain 1 Capital
        </button>
      </div>
      <div className="policy-hand">
        {state.countries[country].policyHand.map((cardId) => {
          const card = getPolicy(cardId)
          const isSelected = cardId === selected
          const cardLegal = canPlayPolicy(state, country, cardId, card.requiresTarget ? state.countryOrder.find((candidate) => candidate !== country) : undefined)
          return (
            <button
              type="button"
              key={cardId}
              className={`policy-card ${isSelected ? 'selected' : ''} ${cardLegal !== true ? 'unaffordable' : ''}`}
              onClick={() => { setSelected(cardId); setTarget(undefined) }}
              aria-pressed={isSelected}
            >
              <span className="policy-kicker">{card.kicker}</span>
              <strong>{card.title}</strong>
              <p>{card.description}</p>
              <span className="policy-index">{String(state.countries[country].policyHand.indexOf(cardId) + 1).padStart(2, '0')}</span>
            </button>
          )
        })}
      </div>
      <div className="action-confirm">
        {policy?.requiresTarget && (
          <div className="target-picker">
            <span>Choose a partner</span>
            <div>
              {state.countryOrder.filter((candidate) => candidate !== country).map((candidate) => (
                <button key={candidate} type="button" className={target === candidate ? 'selected' : ''} onClick={() => setTarget(candidate)}>
                  <span style={{ background: COUNTRY_DEFINITIONS[candidate].color }}>{COUNTRY_DEFINITIONS[candidate].monogram}</span>
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
          onClick={() => policy && onAction({ type: 'PLAY_POLICY', country, cardId: policy.id, target: policy.requiresTarget ? target : undefined })}
        >
          Enact {policy?.title ?? 'policy'} <ChevronRight size={17} />
        </button>
        {legal !== true && <p className="action-error">{legal}</p>}
      </div>
    </div>
  )
}

function CrisisActions({ state, onAction }: ActionDockProps) {
  const country = state.activeCountry
  const crisis = getCrisis(state.currentCrisisId)
  const requirements = crisis.requirements(state.playerCount)
  const totals = getContributionTotals(state)
  const [commitment, setCommitment] = useState<Commitment>({})

  const setAmount = (key: ContributionKey, rawAmount: number) => {
    const stock = key === 'military' ? state.countries[country].military - 1 : state.countries[country].resources[key]
    const amount = Math.max(0, Math.min(stock, rawAmount))
    setCommitment((current) => ({ ...current, [key]: amount }))
  }

  const fairShare = () => {
    const next: Commitment = {}
    const pending = state.countryOrder.filter((candidate) => !state.commitments[candidate]).length
    for (const [key, requirement] of Object.entries(requirements) as [ContributionKey, number][]) {
      const remaining = Math.max(0, requirement - (totals[key] ?? 0))
      const stock = key === 'military' ? state.countries[country].military - 1 : state.countries[country].resources[key]
      next[key] = Math.min(stock, Math.ceil(remaining / pending))
    }
    setCommitment(next)
  }

  const units = Object.values(commitment).reduce((sum, amount) => sum + (amount ?? 0), 0)
  return (
    <div className="action-layout crisis-actions">
      <div className="action-intro">
        <p className="section-label">II · Crisis council</p>
        <h2>Seal your commitment</h2>
        <p>Committed resources are spent whether the table succeeds or fails. Other countries see the running total, not who gave what.</p>
        <button type="button" className="text-button" onClick={fairShare}><Scale size={14} /> Suggest a fair share</button>
      </div>
      <div className="commitment-sliders">
        {(Object.entries(requirements) as [ContributionKey, number][]).map(([key, requirement]) => {
          const amount = commitment[key] ?? 0
          const stock = key === 'military' ? state.countries[country].military : state.countries[country].resources[key]
          const short = Math.max(0, requirement - (totals[key] ?? 0))
          return (
            <div className="commitment-row" key={key}>
              <ResourceMark resource={key} />
              <span className="commitment-need">Table needs <strong>{short}</strong> more</span>
              <div className="stepper">
                <button type="button" onClick={() => setAmount(key, amount - 1)} disabled={amount <= 0} aria-label={`Commit less ${resourceLabel(key)}`}><Minus size={15} /></button>
                <strong>{amount}</strong>
                <button type="button" onClick={() => setAmount(key, amount + 1)} disabled={amount >= stock || (key === 'military' && amount >= stock - 1)} aria-label={`Commit more ${resourceLabel(key)}`}><Plus size={15} /></button>
              </div>
              <small>{stock} held</small>
            </div>
          )
        })}
      </div>
      <div className="action-confirm">
        <div className="sealed-total"><span>Your sealed contribution</span><strong>{units} {units === 1 ? 'unit' : 'units'}</strong></div>
        <button type="button" className="button-primary action-button" onClick={() => onAction({ type: 'SUBMIT_COMMITMENT', country, commitment })}>
          <Send size={16} /> Seal commitment
        </button>
        <p className="fine-print">A zero commitment is legal. Trust may fall if others carry the crisis.</p>
      </div>
    </div>
  )
}

type SummitMode = 'overview' | 'exchange' | 'backchannel'

function SummitActions({ state, onAction }: ActionDockProps) {
  const country = state.activeCountry
  const signing = getSigningStatus(state, country)
  const [mode, setMode] = useState<SummitMode>('overview')
  const [give, setGive] = useState<Resource>('food')
  const [want, setWant] = useState<Resource>('fuel')
  const [target, setTarget] = useState<CountryId>(state.countryOrder.find((candidate) => candidate !== country) ?? country)

  const availableOffers = state.countryOrder
    .map((candidate) => state.summitOffers[candidate])
    .filter((offer) => offer && offer.country !== country)
  const canPost = give !== want && state.countries[country].resources[give] > 0

  return (
    <div className="action-layout summit-actions">
      <div className="action-intro">
        <p className="section-label">III · Peace summit</p>
        <h2>Make one diplomatic move</h2>
        <p>Sign if your coalition is ready, accept a proposal, post a one-for-one exchange, or spend Capital on a backchannel.</p>
        <div className="summit-tabs">
          <button type="button" className={mode === 'overview' ? 'selected' : ''} onClick={() => setMode('overview')}><Handshake size={14} /> Accord</button>
          <button type="button" className={mode === 'exchange' ? 'selected' : ''} onClick={() => setMode('exchange')}><ArrowRightLeft size={14} /> Exchange</button>
          <button type="button" className={mode === 'backchannel' ? 'selected' : ''} onClick={() => setMode('backchannel')}><BookOpen size={14} /> Backchannel</button>
        </div>
      </div>

      <div className="summit-workspace">
        {mode === 'overview' && (
          <div className="accord-overview">
            <div className={`signing-status ${signing.eligible ? 'ready' : ''}`}>
              <span className="accord-seal">{signing.eligible ? <Sparkles /> : <CircleOff />}</span>
              <div><strong>{signing.eligible ? 'Your delegation can sign' : 'Your delegation is not ready'}</strong>
                {signing.eligible ? <p>The mandate, red line, Peace, and Trust requirements are all met.</p> : <ul>{signing.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
              </div>
            </div>
            {availableOffers.length > 0 && (
              <div className="proposal-list">
                <span>Proposals on the table</span>
                {availableOffers.map((offer) => offer && (
                  <button
                    type="button"
                    key={offer.country}
                    disabled={state.countries[country].resources[offer.want] < 1}
                    onClick={() => onAction({ type: 'ACCEPT_OFFER', country, offerCountry: offer.country })}
                  >
                    <span className="proposal-country">{COUNTRY_DEFINITIONS[offer.country].monogram}</span>
                    <strong>{COUNTRY_DEFINITIONS[offer.country].name}</strong>
                    <span>gives <b>{RESOURCE_META[offer.give].label}</b></span>
                    <ArrowRightLeft size={14} />
                    <span>wants <b>{RESOURCE_META[offer.want].label}</b></span>
                    <em>Accept</em>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {mode === 'exchange' && (
          <div className="exchange-builder">
            <p>Post a public one-for-one proposal. It stays open until accepted or the round ends.</p>
            <div className="exchange-sides">
              <label><span>You give</span><select value={give} onChange={(event) => setGive(event.target.value as Resource)}>{RESOURCES.map((resource) => <option key={resource} value={resource}>{RESOURCE_META[resource].label} · {state.countries[country].resources[resource]} held</option>)}</select></label>
              <ArrowRightLeft aria-hidden="true" />
              <label><span>You request</span><select value={want} onChange={(event) => setWant(event.target.value as Resource)}>{RESOURCES.map((resource) => <option key={resource} value={resource}>{RESOURCE_META[resource].label}</option>)}</select></label>
            </div>
          </div>
        )}
        {mode === 'backchannel' && (
          <div className="backchannel-builder">
            <p>Spend 1 Capital to build 2 Trust, reveal a country’s mandate, and gain 1 Peace Momentum.</p>
            <div className="partner-grid">
              {state.countryOrder.filter((candidate) => candidate !== country).map((candidate) => (
                <button type="button" key={candidate} className={target === candidate ? 'selected' : ''} onClick={() => setTarget(candidate)}>
                  <span style={{ background: COUNTRY_DEFINITIONS[candidate].color }}>{COUNTRY_DEFINITIONS[candidate].monogram}</span>
                  <strong>{COUNTRY_DEFINITIONS[candidate].name}</strong>
                  <small>Trust {getTrust(state, country, candidate)}/4</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="action-confirm">
        {mode === 'overview' && <button type="button" className="button-primary action-button" disabled={!signing.eligible} onClick={() => onAction({ type: 'SIGN_TREATY', country })}><Check size={17} /> Sign the Vellan Accord</button>}
        {mode === 'exchange' && <button type="button" className="button-primary action-button" disabled={!canPost} onClick={() => onAction({ type: 'POST_OFFER', country, give, want })}><ArrowRightLeft size={16} /> Post proposal</button>}
        {mode === 'backchannel' && <button type="button" className="button-primary action-button" disabled={state.countries[country].resources.capital < 1 || target === country} onClick={() => onAction({ type: 'BUILD_TRUST', country, target })}><BookOpen size={16} /> Open backchannel</button>}
        <button type="button" className="button-pass" onClick={() => onAction({ type: 'PASS_SUMMIT', country })}>Pass this summit move</button>
      </div>
    </div>
  )
}

function BriefingActions({ state, onAction }: ActionDockProps) {
  const crisis = getCrisis(state.currentCrisisId)
  return (
    <div className="phase-briefing">
      <div className="briefing-round"><span>ROUND</span><strong>{String(state.round).padStart(2, '0')}</strong><small>OF {state.maxRounds}</small></div>
      <div className="briefing-copy">
        <p className="section-label">Incoming dispatch · {crisis.location}</p>
        <h2>{crisis.title}</h2>
        <p>{crisis.briefing}</p>
      </div>
      <div className="briefing-chair"><span>Chair this round</span><strong>{COUNTRY_DEFINITIONS[state.firstPlayer].name}</strong><small>Cabinet → crisis → summit</small></div>
      <button type="button" className="button-primary action-button" onClick={() => onAction({ type: 'ACKNOWLEDGE_BRIEFING' })}>Open cabinet <ChevronRight size={18} /></button>
    </div>
  )
}

function AftermathActions({ state, onAction }: ActionDockProps) {
  const result = state.lastCrisisResult
  if (!result) return null
  return (
    <div className={`round-aftermath ${result.succeeded ? 'success' : 'failure'}`}>
      <span className="aftermath-mark">{result.succeeded ? <Check /> : <CircleOff />}</span>
      <div><p className="section-label">Round {state.round} communiqué</p><h2>{result.headline}</h2><p>{result.detail}</p></div>
      <div className="aftermath-totals">
        {(Object.entries(result.requirements) as [ContributionKey, number][]).map(([key, required]) => (
          <span key={key}><ResourceMark resource={key} compact /><strong>{result.totals[key] ?? 0}/{required}</strong></span>
        ))}
      </div>
      <button type="button" className="button-primary action-button" onClick={() => onAction({ type: 'CONTINUE_ROUND' })}>
        {state.round === state.maxRounds ? 'Read the final outcome' : `Begin round ${state.round + 1}`} <ChevronRight size={17} />
      </button>
    </div>
  )
}

export function ActionDock(props: ActionDockProps) {
  const key = `${props.state.round}-${props.state.phase}-${props.state.activeCountry}`
  return (
    <section className={`action-dock phase-${props.state.phase}`} aria-label="Current action" key={key}>
      {props.state.phase === 'briefing' && <BriefingActions {...props} />}
      {props.state.phase === 'cabinet' && <CabinetActions {...props} />}
      {props.state.phase === 'crisis' && <CrisisActions {...props} />}
      {props.state.phase === 'summit' && <SummitActions {...props} />}
      {props.state.phase === 'aftermath' && <AftermathActions {...props} />}
    </section>
  )
}
