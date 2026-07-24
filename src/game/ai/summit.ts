import { reduceGame } from '../reducer'
import { getSigningStatus, getTrust } from '../rules'
import {
  RESOURCES,
  type CountryId,
  type GameAction,
  type GameState,
  type Resource,
} from '../types'
import { reserveFor } from './reserves'
import { strategicScore } from './scoring'

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
    .filter(
      (resource) =>
        !wants.includes(resource) &&
        state.countries[country].resources[resource] > reserveFor(country, resource),
    )
    .sort(
      (first, second) =>
        state.countries[country].resources[second] -
        state.countries[country].resources[first],
    )[0]
  const want = wants.find((resource) => resource !== give)
  if (give && want) return { type: 'POST_OFFER', country, give, want }

  return { type: 'PASS_SUMMIT', country }
}
