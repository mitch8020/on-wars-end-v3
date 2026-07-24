import { getCrisis } from '../data'
import { getContributionTotals } from '../rules'
import type { Commitment, ContributionKey, GameAction, GameState } from '../types'
import { reserveFor } from './reserves'

export function chooseAiCommitment(state: GameState): GameAction {
  const country = state.activeCountry
  const requirements = getCrisis(state.currentCrisisId).requirements(state.playerCount)
  const totals = getContributionTotals(state)
  const pending = state.countryOrder.filter((candidate) => !state.commitments[candidate]).length
  const commitment: Commitment = {}

  for (const [key, requirement] of Object.entries(requirements) as [ContributionKey, number][]) {
    const remaining = Math.max(0, requirement - (totals[key] ?? 0))
    if (remaining === 0) continue
    const desired = Math.ceil(remaining / pending)
    const stock =
      key === 'military'
        ? state.countries[country].military
        : state.countries[country].resources[key]
    const reserve = pending === 1 ? Math.min(1, reserveFor(country, key)) : reserveFor(country, key)
    const available = Math.max(0, stock - reserve)
    commitment[key] = Math.min(desired, available)
  }
  return { type: 'SUBMIT_COMMITMENT', country, commitment }
}
