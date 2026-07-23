import { COUNTRY_DEFINITIONS, MAX_TRACK, POLICY_CARDS } from './data'
import { shuffle } from './random'
import { RESOURCES, type CountryId, type GameState, type PolicyCard, type Resource } from './types'

export function clamp(value: number, minimum = 0, maximum = MAX_TRACK): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function cloneGameState(state: GameState): GameState {
  return structuredClone(state)
}

export function appendLog(state: GameState, message: string, country?: CountryId): void {
  state.log.push({
    id: state.log.length,
    round: state.round,
    phase: state.phase,
    country,
    message,
  })
}

export function dealPolicyHands(state: GameState): void {
  const policyIds = POLICY_CARDS.map((policy) => policy.id)
  for (const country of state.countryOrder) {
    let shuffled
    ;[shuffled, state.rngState] = shuffle(policyIds, state.rngState)
    state.countries[country].policyHand = shuffled.slice(0, 3)
    state.countries[country].policyPlayed = null
  }
}

export function changeTrust(state: GameState, first: CountryId, second: CountryId, amount: number): void {
  if (first === second) return
  const key = first < second ? `${first}:${second}` : `${second}:${first}`
  state.trust[key] = clamp((state.trust[key] ?? 0) + amount, 0, 4)
}

export function spendResources(
  country: GameState['countries'][CountryId],
  cost: Partial<Record<Resource, number>>,
): void {
  for (const resource of RESOURCES) country.resources[resource] -= cost[resource] ?? 0
}

export function gainResources(
  country: GameState['countries'][CountryId],
  gain: Partial<Record<Resource, number>>,
): void {
  for (const resource of RESOURCES) country.resources[resource] += gain[resource] ?? 0
}

export function applyPolicy(state: GameState, country: CountryId, policy: PolicyCard, target?: CountryId): void {
  const current = state.countries[country]
  spendResources(current, policy.cost ?? {})
  gainResources(current, policy.gain ?? {})

  if (policy.id === 'relief-corridor') {
    const resettled = Math.min(2, state.refugeePool)
    state.refugeePool -= resettled
    current.civilianPopulation += resettled
  } else {
    current.civilianPopulation += policy.civilianDelta ?? 0
    state.refugeePool = Math.max(0, state.refugeePool + (policy.refugeeDelta ?? 0))
  }
  current.military += policy.militaryDelta ?? 0
  state.globalUnrest = clamp(state.globalUnrest + (policy.unrestDelta ?? 0))
  state.peaceMomentum = clamp(state.peaceMomentum + (policy.peaceDelta ?? 0))

  if (target) {
    const partner = state.countries[target]
    partner.civilianPopulation += policy.targetCivilianDelta ?? 0
    partner.military += policy.targetMilitaryDelta ?? 0
    if (policy.trustDelta) changeTrust(state, country, target, policy.trustDelta)
    if (policy.revealMandate) partner.mandateRevealed = true
  }
  current.policyPlayed = policy.id
  appendLog(state, `${COUNTRY_DEFINITIONS[country].name} enacts ${policy.title}.`, country)
}
