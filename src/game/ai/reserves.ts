import type { ContributionKey, CountryId } from '../types'

const COUNTRY_RESERVES: Partial<
  Record<CountryId, Partial<Record<ContributionKey, number>>>
> = {
  aravell: { fuel: 2, capital: 2, military: 2 },
  tomerin: { food: 2, military: 2 },
  veyra: { industry: 2, fuel: 1, capital: 1, military: 2 },
  karsk: { military: 5, capital: 2 },
  belovar: { capital: 5, military: 2 },
  namarra: { food: 1, capital: 1, military: 2 },
}

export function reserveFor(country: CountryId, key: ContributionKey): number {
  return COUNTRY_RESERVES[country]?.[key] ?? 1
}
