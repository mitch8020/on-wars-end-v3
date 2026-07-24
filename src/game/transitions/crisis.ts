import { COUNTRY_DEFINITIONS, getCrisis } from '../data'
import { getContributionTotals } from '../rules'
import { appendLog, changeTrust, clamp } from '../state'
import type { Commitment, ContributionKey, GameState } from '../types'
import { finalizeTransition, nextPendingCountry } from './lifecycle'
import type { ActionOf } from './types'

function contributionUnits(commitment: Commitment): number {
  return Object.values(commitment).reduce((sum, value) => sum + value, 0)
}

function resolveCrisis(state: GameState): void {
  const crisis = getCrisis(state.currentCrisisId)
  const requirements = crisis.requirements(state.playerCount)
  const totals = getContributionTotals(state)
  const succeeded = Object.entries(requirements).every(
    ([key, requirement]) => (totals[key as ContributionKey] ?? 0) >= requirement,
  )
  const result = succeeded ? crisis.success : crisis.failure

  state.peaceMomentum = clamp(state.peaceMomentum + result.peace)
  state.globalUnrest = clamp(state.globalUnrest + result.unrest)
  if (succeeded) {
    state.refugeePool = Math.max(0, state.refugeePool + (crisis.success.refugees ?? 0))
  } else {
    state.refugeePool += crisis.failure.refugees?.(state.playerCount) ?? 0
    for (const country of state.countryOrder) {
      state.countries[country].civilianPopulation -= crisis.failure.civilianLoss ?? 0
      state.countries[country].military -= crisis.failure.militaryLoss ?? 0
    }
  }

  const totalRequired = contributionUnits(requirements)
  const responsibleAt = Math.max(1, Math.floor((totalRequired / state.playerCount) * 0.6))
  for (let first = 0; first < state.countryOrder.length; first += 1) {
    for (let second = first + 1; second < state.countryOrder.length; second += 1) {
      const firstCountry = state.countryOrder[first]
      const secondCountry = state.countryOrder[second]
      const firstUnits = contributionUnits(state.commitments[firstCountry]!)
      const secondUnits = contributionUnits(state.commitments[secondCountry]!)
      if (firstUnits >= responsibleAt && secondUnits >= responsibleAt) {
        changeTrust(state, firstCountry, secondCountry, 1)
      } else if ((firstUnits === 0) !== (secondUnits === 0)) {
        changeTrust(state, firstCountry, secondCountry, -1)
      }
    }
  }

  state.lastCrisisResult = {
    crisisId: crisis.id,
    succeeded,
    totals,
    requirements,
    headline: result.headline,
    detail: result.detail,
  }
  appendLog(state, `${crisis.title}: ${result.headline}.`)
}

export function submitCommitment(
  state: GameState,
  action: ActionOf<'SUBMIT_COMMITMENT'>,
): GameState {
  if (state.phase !== 'crisis') throw new Error('The crisis council is not accepting commitments.')
  if (state.activeCountry !== action.country) throw new Error('It is another country’s commitment window.')
  if (state.commitments[action.country]) throw new Error('This country has already committed.')

  const requirements = getCrisis(state.currentCrisisId).requirements(state.playerCount)
  const clean: Commitment = {}
  for (const [key, rawAmount] of Object.entries(action.commitment) as [ContributionKey, number][]) {
    const amount = Math.round(rawAmount)
    if (!Object.hasOwn(requirements, key)) throw new Error(`${key} is not requested by this crisis.`)
    if (amount < 0 || amount !== rawAmount) throw new Error('Commitments must be whole, non-negative units.')
    const available =
      key === 'military'
        ? state.countries[action.country].military
        : state.countries[action.country].resources[key]
    if (amount > available) throw new Error(`Not enough ${key} to commit.`)
    if (key === 'military' && available - amount <= 0) {
      throw new Error('A commitment cannot eliminate the country’s military.')
    }
    if (amount > 0) clean[key] = amount
  }

  for (const [key, amount] of Object.entries(clean) as [ContributionKey, number][]) {
    if (key === 'military') state.countries[action.country].military -= amount
    else state.countries[action.country].resources[key] -= amount
  }
  state.commitments[action.country] = clean
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} seals its crisis commitment.`,
    action.country,
  )

  const following = nextPendingCountry(state, (country) => Boolean(state.commitments[country]))
  if (following) {
    state.activeCountry = following
  } else {
    resolveCrisis(state)
    state.phase = 'summit'
    state.activeCountry = state.firstPlayer
    appendLog(state, 'The crisis resolves. The peace summit opens.')
  }
  return finalizeTransition(state)
}
