import { COUNTRY_DEFINITIONS } from '../data'
import { getSigningStatus } from '../rules'
import { appendLog, changeTrust, clamp } from '../state'
import type { CountryId, GameState, Resource } from '../types'
import { finalizeTransition, nextPendingCountry } from './lifecycle'
import type { ActionOf } from './types'

function assertSummitTurn(state: GameState, country: CountryId): void {
  if (state.phase !== 'summit' || state.activeCountry !== country) {
    throw new Error('It is another country’s summit turn.')
  }
}

function markSummitTurnAndAdvance(state: GameState, country: CountryId): void {
  state.summitTurnsTaken[country] = true
  const following = nextPendingCountry(state, (candidate) => Boolean(state.summitTurnsTaken[candidate]))
  if (following) {
    state.activeCountry = following
  } else {
    state.phase = 'aftermath'
    state.activeCountry = state.firstPlayer
    appendLog(state, `Round ${state.round} closes. The communiqués are drafted.`)
  }
}

function transferOne(state: GameState, from: CountryId, to: CountryId, resource: Resource): void {
  state.countries[from].resources[resource] -= 1
  state.countries[to].resources[resource] += 1
}

function allSigned(state: GameState): boolean {
  return state.countryOrder.every((country) => state.countries[country].signed)
}

function victoryEnding(state: GameState): GameState['ending'] {
  return {
    result: 'victory',
    title: 'The guns fall silent',
    reason: `All ${state.playerCount} countries signed with their mandates intact.`,
    epilogue:
      'No one cheers when the last pen leaves the paper. Along the Vellan front, radios go quiet one post at a time. By morning, trains carry grain instead of shells—and for the first time in years, the border is only a line on a map.',
  }
}

export function postOffer(state: GameState, action: ActionOf<'POST_OFFER'>): GameState {
  assertSummitTurn(state, action.country)
  if (action.give === action.want) throw new Error('An exchange must name two different resources.')
  if (state.countries[action.country].resources[action.give] < 1) {
    throw new Error(`No ${action.give} is available to offer.`)
  }
  state.summitOffers[action.country] = {
    country: action.country,
    give: action.give,
    want: action.want,
  }
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} posts a ${action.give}-for-${action.want} proposal.`,
    action.country,
  )
  markSummitTurnAndAdvance(state, action.country)
  return finalizeTransition(state)
}

export function acceptOffer(state: GameState, action: ActionOf<'ACCEPT_OFFER'>): GameState {
  assertSummitTurn(state, action.country)
  const offer = state.summitOffers[action.offerCountry]
  if (!offer || offer.country === action.country) throw new Error('That proposal is not available.')
  if (state.countries[offer.country].resources[offer.give] < 1) {
    throw new Error('The proposer can no longer honor that proposal.')
  }
  if (state.countries[action.country].resources[offer.want] < 1) {
    throw new Error(`You need 1 ${offer.want} to accept.`)
  }
  transferOne(state, offer.country, action.country, offer.give)
  transferOne(state, action.country, offer.country, offer.want)
  changeTrust(state, action.country, offer.country, 1)
  state.peaceMomentum = clamp(state.peaceMomentum + 1)
  delete state.summitOffers[action.offerCountry]
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} accepts ${COUNTRY_DEFINITIONS[offer.country].name}’s exchange.`,
    action.country,
  )
  markSummitTurnAndAdvance(state, action.country)
  return finalizeTransition(state)
}

export function buildTrust(state: GameState, action: ActionOf<'BUILD_TRUST'>): GameState {
  assertSummitTurn(state, action.country)
  if (action.target === action.country || !state.countryOrder.includes(action.target)) {
    throw new Error('Choose another country.')
  }
  if (state.countries[action.country].resources.capital < 1) {
    throw new Error('A backchannel costs 1 Capital.')
  }
  state.countries[action.country].resources.capital -= 1
  changeTrust(state, action.country, action.target, 2)
  state.countries[action.target].mandateRevealed = true
  state.peaceMomentum = clamp(state.peaceMomentum + 1)
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} opens a backchannel with ${COUNTRY_DEFINITIONS[action.target].name}.`,
    action.country,
  )
  markSummitTurnAndAdvance(state, action.country)
  return finalizeTransition(state)
}

export function signTreaty(state: GameState, action: ActionOf<'SIGN_TREATY'>): GameState {
  assertSummitTurn(state, action.country)
  const status = getSigningStatus(state, action.country)
  if (!status.eligible) throw new Error(status.reasons.join(' '))
  state.countries[action.country].signed = true
  state.peaceMomentum = clamp(state.peaceMomentum + 1)
  appendLog(state, `${COUNTRY_DEFINITIONS[action.country].name} signs the Vellan Accord.`, action.country)
  if (allSigned(state)) {
    state.ending = victoryEnding(state)
    state.phase = 'ended'
  } else {
    markSummitTurnAndAdvance(state, action.country)
  }
  return finalizeTransition(state)
}

export function passSummit(state: GameState, action: ActionOf<'PASS_SUMMIT'>): GameState {
  assertSummitTurn(state, action.country)
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} closes its summit window without an agreement.`,
    action.country,
  )
  markSummitTurnAndAdvance(state, action.country)
  return finalizeTransition(state)
}
