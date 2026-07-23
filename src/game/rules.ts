import { getPolicy } from './data'
import {
  RESOURCES,
  type Commitment,
  type ContributionKey,
  type CountryId,
  type CountryState,
  type GameState,
  type Resource,
} from './types'

export function trustKey(first: CountryId, second: CountryId): string {
  return first < second ? `${first}:${second}` : `${second}:${first}`
}

export function getTrust(state: GameState, first: CountryId, second: CountryId): number {
  if (first === second) return 4
  return state.trust[trustKey(first, second)] ?? 0
}

export function averageTrust(state: GameState, country: CountryId): number {
  const others = state.countryOrder.filter((candidate) => candidate !== country)
  if (others.length === 0) return 4
  return others.reduce((sum, candidate) => sum + getTrust(state, country, candidate), 0) / others.length
}

export function isRedLineSafe(state: GameState, country: CountryId): boolean {
  const current = state.countries[country]
  switch (country) {
    case 'aravell':
      return current.resources.fuel > 0
    case 'tomerin':
      return state.globalUnrest < 7
    case 'veyra':
      return current.resources.capital > 0
    case 'karsk':
      return current.military > 2
    case 'belovar':
      return current.civilianPopulation > 3
    case 'namarra':
      return state.refugeePool <= 4 * state.playerCount
  }
}

export function isMandateMet(state: GameState, country: CountryId): boolean {
  const current = state.countries[country]
  switch (country) {
    case 'aravell':
      return current.resources.fuel >= 3 && current.resources.capital >= 3
    case 'tomerin':
      return current.resources.food >= 3 && state.globalUnrest <= 4
    case 'veyra':
      return current.resources.industry >= 3 && current.resources.fuel >= 2
    case 'karsk':
      return current.military >= 6 && current.resources.capital >= 3
    case 'belovar':
      return current.resources.capital >= 6 && current.civilianPopulation >= 6
    case 'namarra':
      return current.civilianPopulation >= 10 && state.refugeePool <= 3 * state.playerCount
  }
}

export type SigningStatus = { eligible: boolean; reasons: string[] }

export function getSigningStatus(state: GameState, country: CountryId): SigningStatus {
  const current = state.countries[country]
  if (current.signed) return { eligible: false, reasons: ['Treaty already signed'] }
  const reasons: string[] = []
  if (!isMandateMet(state, country)) reasons.push('National mandate is not met')
  if (!isRedLineSafe(state, country) || current.underPressure) reasons.push('A national red line is under pressure')
  if (state.peaceMomentum < 6) reasons.push(`Peace needs ${6 - state.peaceMomentum} more momentum`)
  const trust = averageTrust(state, country)
  if (trust < 2) reasons.push(`Average Trust is ${trust.toFixed(1)}; it must reach 2.0`)
  return { eligible: reasons.length === 0, reasons }
}

function hasResources(country: CountryState, cost: Partial<Record<Resource, number>>): boolean {
  return RESOURCES.every((resource) => country.resources[resource] >= (cost[resource] ?? 0))
}

export function canPlayPolicy(state: GameState, country: CountryId, cardId: string, target?: CountryId): string | true {
  if (state.phase !== 'cabinet') return 'Cabinet is not in session.'
  if (state.activeCountry !== country) return 'It is another country’s turn.'
  const current = state.countries[country]
  if (!current.policyHand.includes(cardId)) return 'That policy is not in this cabinet hand.'
  const policy = getPolicy(cardId)
  if (!hasResources(current, policy.cost ?? {})) return 'The policy cost cannot be paid.'
  if (policy.requiresTarget && (!target || target === country || !state.countryOrder.includes(target))) {
    return 'Choose another country.'
  }
  if ((policy.militaryDelta ?? 0) < 0 && current.military + (policy.militaryDelta ?? 0) <= 0) {
    return 'This would leave the country without a military.'
  }
  if (
    target &&
    (policy.targetMilitaryDelta ?? 0) < 0 &&
    state.countries[target].military + (policy.targetMilitaryDelta ?? 0) <= 0
  ) {
    return 'This would leave the partner without a military.'
  }
  if (policy.id === 'relief-corridor' && state.refugeePool === 0) return 'There are no refugees to resettle.'
  return true
}

export function getContributionTotals(state: GameState): Commitment {
  const totals: Commitment = {}
  for (const contribution of Object.values(state.commitments)) {
    if (!contribution) continue
    for (const [key, amount] of Object.entries(contribution) as [ContributionKey, number][]) {
      totals[key] = (totals[key] ?? 0) + amount
    }
  }
  return totals
}
