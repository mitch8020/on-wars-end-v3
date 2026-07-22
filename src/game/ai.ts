import { COUNTRY_DEFINITIONS, getCrisis, getPolicy } from './data'
import {
  averageTrust,
  canPlayPolicy,
  getContributionTotals,
  getSigningStatus,
  getTrust,
  isMandateMet,
  isRedLineSafe,
  reduceGame,
} from './engine'
import { RESOURCES, type Commitment, type ContributionKey, type CountryId, type GameAction, type GameState, type Resource } from './types'

function mandateResourceValue(state: GameState, country: CountryId): number {
  const current = state.countries[country]
  switch (country) {
    case 'aravell':
      return Math.min(current.resources.fuel, 3) * 3 + Math.min(current.resources.capital, 3) * 2
    case 'tomerin':
      return Math.min(current.resources.food, 3) * 3 - Math.max(0, state.globalUnrest - 4) * 4
    case 'veyra':
      return Math.min(current.resources.industry, 3) * 3 + Math.min(current.resources.fuel, 2) * 2
    case 'karsk':
      return Math.min(current.military, 6) * 2 + Math.min(current.resources.capital, 3) * 3
    case 'belovar':
      return Math.min(current.resources.capital, 6) * 2 + Math.min(current.civilianPopulation, 6)
    case 'namarra':
      return Math.min(current.civilianPopulation, 10) * 2 - Math.max(0, state.refugeePool - 3 * state.playerCount) * 2
  }
}

function strategicScore(state: GameState, country: CountryId): number {
  if (state.ending?.result === 'victory') return 100_000
  if (state.ending?.result === 'defeat') return -100_000
  const current = state.countries[country]
  const allResources = RESOURCES.reduce((sum, resource) => sum + current.resources[resource], 0)
  const mandatesMet = state.countryOrder.filter((candidate) => isMandateMet(state, candidate)).length
  const redLinesSafe = state.countryOrder.filter((candidate) => isRedLineSafe(state, candidate)).length
  return (
    mandateResourceValue(state, country) * 4 +
    (isMandateMet(state, country) ? 45 : 0) +
    (isRedLineSafe(state, country) ? 20 : -30) +
    (current.signed ? 70 : 0) +
    averageTrust(state, country) * 7 +
    state.peaceMomentum * 6 -
    state.globalUnrest * 5 -
    state.refugeePool * 1.5 +
    current.civilianPopulation * 2 +
    current.military * 1.5 +
    allResources * 0.8 +
    mandatesMet * 5 +
    redLinesSafe * 3
  )
}

export function chooseAiPolicy(state: GameState): GameAction {
  const country = state.activeCountry
  const candidates: GameAction[] = [{ type: 'CONSERVE_RESOURCES', country }]
  for (const cardId of state.countries[country].policyHand) {
    const policy = getPolicy(cardId)
    const targets = policy.requiresTarget ? state.countryOrder.filter((candidate) => candidate !== country) : [undefined]
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

function reserveFor(country: CountryId, key: ContributionKey): number {
  const reserves: Partial<Record<CountryId, Partial<Record<ContributionKey, number>>>> = {
    aravell: { fuel: 2, capital: 2, military: 2 },
    tomerin: { food: 2, military: 2 },
    veyra: { industry: 2, fuel: 1, capital: 1, military: 2 },
    karsk: { military: 5, capital: 2 },
    belovar: { capital: 5, military: 2 },
    namarra: { food: 1, capital: 1, military: 2 },
  }
  return reserves[country]?.[key] ?? 1
}

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
    const stock = key === 'military' ? state.countries[country].military : state.countries[country].resources[key]
    const reserve = pending === 1 ? Math.min(1, reserveFor(country, key)) : reserveFor(country, key)
    const available = Math.max(0, stock - reserve)
    commitment[key] = Math.min(desired, available)
  }
  return { type: 'SUBMIT_COMMITMENT', country, commitment }
}

function neededResources(state: GameState, country: CountryId): Resource[] {
  const current = state.countries[country]
  switch (country) {
    case 'aravell':
      return [
        ...(current.resources.fuel < 3 ? (['fuel'] as Resource[]) : []),
        ...(current.resources.capital < 3 ? (['capital'] as Resource[]) : []),
      ]
    case 'tomerin':
      return current.resources.food < 3 ? ['food'] : []
    case 'veyra':
      return [
        ...(current.resources.industry < 3 ? (['industry'] as Resource[]) : []),
        ...(current.resources.fuel < 2 ? (['fuel'] as Resource[]) : []),
      ]
    case 'karsk':
      return current.resources.capital < 3 ? ['capital'] : []
    case 'belovar':
      return current.resources.capital < 6 ? ['capital'] : []
    case 'namarra':
      return current.resources.food < 2 ? ['food'] : []
  }
}

export function chooseAiSummitAction(state: GameState): GameAction {
  const country = state.activeCountry
  if (getSigningStatus(state, country).eligible) return { type: 'SIGN_TREATY', country }

  let bestOffer: CountryId | null = null
  let bestOfferScore = strategicScore(state, country)
  for (const offerCountry of state.countryOrder) {
    const offer = state.summitOffers[offerCountry]
    if (!offer || offerCountry === country || state.countries[country].resources[offer.want] < 1) continue
    try {
      const result = reduceGame(state, { type: 'ACCEPT_OFFER', country, offerCountry })
      const score = strategicScore(result, country)
      if (score > bestOfferScore + 1) {
        bestOffer = offerCountry
        bestOfferScore = score
      }
    } catch {
      // Stale proposals are skipped.
    }
  }
  if (bestOffer) return { type: 'ACCEPT_OFFER', country, offerCountry: bestOffer }

  if (state.countries[country].resources.capital > 1) {
    const target = state.countryOrder
      .filter((candidate) => candidate !== country)
      .sort((first, second) => getTrust(state, country, first) - getTrust(state, country, second))[0]
    if (getTrust(state, country, target) < 3 || state.peaceMomentum < 6) {
      return { type: 'BUILD_TRUST', country, target }
    }
  }

  const wants = neededResources(state, country)
  const give = [...RESOURCES]
    .filter((resource) => !wants.includes(resource) && state.countries[country].resources[resource] > reserveFor(country, resource))
    .sort((first, second) => state.countries[country].resources[second] - state.countries[country].resources[first])[0]
  const want = wants.find((resource) => resource !== give)
  if (give && want) return { type: 'POST_OFFER', country, give, want }

  return { type: 'PASS_SUMMIT', country }
}

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
