import { getPolicy } from '../data'
import { reduceGame } from '../reducer'
import { canPlayPolicy } from '../rules'
import type { GameAction, GameState } from '../types'
import { strategicScore } from './scoring'

export function chooseAiPolicy(state: GameState): GameAction {
  const country = state.activeCountry
  const candidates: GameAction[] = [{ type: 'CONSERVE_RESOURCES', country }]
  for (const cardId of state.countries[country].policyHand) {
    const policy = getPolicy(cardId)
    const targets = policy.requiresTarget
      ? state.countryOrder.filter((candidate) => candidate !== country)
      : [undefined]
    for (const target of targets) {
      if (canPlayPolicy(state, country, cardId, target) === true) {
        candidates.push({ type: 'PLAY_POLICY', country, cardId, target })
      }
    }
  }

  let best = candidates[0]
  let bestScore = Number.NEGATIVE_INFINITY
  for (const action of candidates) {
    try {
      const result = reduceGame(state, action)
      const score = strategicScore(result, country)
      if (score > bestScore) {
        best = action
        bestScore = score
      }
    } catch {
      // A preview may expose a red-line edge case; illegal candidates are ignored.
    }
  }
  return best
}
