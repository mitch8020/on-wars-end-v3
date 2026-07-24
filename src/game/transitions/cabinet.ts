import { COUNTRY_DEFINITIONS, getPolicy } from '../data'
import { canPlayPolicy } from '../rules'
import { appendLog, applyPolicy } from '../state'
import type { GameState } from '../types'
import { finalizeTransition, nextPendingCountry } from './lifecycle'
import type { ActionOf } from './types'

function advanceCabinet(state: GameState): GameState {
  const following = nextPendingCountry(state, (country) => Boolean(state.countries[country].policyPlayed))
  if (following) {
    state.activeCountry = following
  } else {
    state.phase = 'crisis'
    state.activeCountry = state.firstPlayer
    appendLog(state, 'Cabinet planning ends. Commitments to the shared crisis begin.')
  }
  return finalizeTransition(state)
}

export function playPolicy(state: GameState, action: ActionOf<'PLAY_POLICY'>): GameState {
  const legal = canPlayPolicy(state, action.country, action.cardId, action.target)
  if (legal !== true) throw new Error(legal)
  applyPolicy(state, action.country, getPolicy(action.cardId), action.target)
  return advanceCabinet(state)
}

export function conserveResources(
  state: GameState,
  action: ActionOf<'CONSERVE_RESOURCES'>,
): GameState {
  if (state.phase !== 'cabinet' || state.activeCountry !== action.country) {
    throw new Error('It is another country’s cabinet turn.')
  }
  state.countries[action.country].resources.capital += 1
  state.countries[action.country].policyPlayed = 'conserve-resources'
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} conserves resources and gains 1 Capital.`,
    action.country,
  )
  return advanceCabinet(state)
}
