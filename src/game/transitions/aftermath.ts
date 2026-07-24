import { COUNTRY_DEFINITIONS } from '../data'
import { appendLog, dealPolicyHands } from '../state'
import type { GameState } from '../types'
import { finalizeTransition } from './lifecycle'

export function continueRound(state: GameState): GameState {
  if (state.phase !== 'aftermath') throw new Error('The round is not ready to close.')
  if (state.round >= state.maxRounds) {
    const unsigned = state.countryOrder.filter((country) => !state.countries[country].signed)
    state.ending = {
      result: 'defeat',
      title: 'Peace arrives one round too late',
      reason: `${unsigned.map((country) => COUNTRY_DEFINITIONS[country].name).join(', ')} did not sign by the end of Round ${state.maxRounds}.`,
      epilogue:
        'By morning, every delegation can describe the agreement they should have made. The front does not wait for hindsight.',
    }
    state.phase = 'ended'
    return finalizeTransition(state)
  }

  const formerFirst = state.countryOrder.indexOf(state.firstPlayer)
  state.firstPlayer = state.countryOrder[(formerFirst + 1) % state.countryOrder.length]
  state.activeCountry = state.firstPlayer
  state.round += 1
  state.phase = 'briefing'
  state.currentCrisisId = state.crisisDeck[0]
  state.crisisDeck = state.crisisDeck.slice(1)
  state.commitments = {}
  state.summitOffers = {}
  state.summitTurnsTaken = {}
  state.lastCrisisResult = null
  dealPolicyHands(state)
  appendLog(
    state,
    `Round ${state.round} begins. ${COUNTRY_DEFINITIONS[state.firstPlayer].name} now holds the chair.`,
  )
  return finalizeTransition(state)
}
