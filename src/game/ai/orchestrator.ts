import { COUNTRY_DEFINITIONS } from '../data'
import { reduceGame } from '../reducer'
import { averageTrust } from '../rules'
import type { CountryId, GameAction, GameState } from '../types'
import { chooseAiPolicy } from './cabinet'
import { chooseAiCommitment } from './crisis'
import { chooseAiSummitAction } from './summit'

export function chooseAiAction(state: GameState): GameAction | null {
  if (state.phase === 'cabinet') return chooseAiPolicy(state)
  if (state.phase === 'crisis') return chooseAiCommitment(state)
  if (state.phase === 'summit') return chooseAiSummitAction(state)
  return null
}

export function runAiUntilHumanOrPause(state: GameState): GameState {
  let next = state
  let guard = 0
  while (
    !next.ending &&
    next.controllers[next.activeCountry] === 'ai' &&
    (next.phase === 'cabinet' || next.phase === 'crisis' || next.phase === 'summit')
  ) {
    guard += 1
    if (guard > 100) throw new Error('AI turn guard exceeded.')
    const action = chooseAiAction(next)
    if (!action) break
    next = reduceGame(next, action)
  }
  return next
}

export function describeAi(state: GameState, country: CountryId): string {
  const definition = COUNTRY_DEFINITIONS[country]
  return `${definition.name} weighs ${definition.pressure.toLowerCase()} against a Trust average of ${averageTrust(state, country).toFixed(1)}.`
}
