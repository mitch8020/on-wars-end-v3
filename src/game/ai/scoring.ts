import { averageTrust, isMandateMet, isRedLineSafe } from '../rules'
import { RESOURCES, type CountryId, type GameState } from '../types'

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
      return (
        Math.min(current.civilianPopulation, 10) * 2 -
        Math.max(0, state.refugeePool - 3 * state.playerCount) * 2
      )
  }
}

export function strategicScore(state: GameState, country: CountryId): number {
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
