export const COUNTRY_IDS = ['aravell', 'tomerin', 'veyra', 'karsk', 'belovar', 'namarra'] as const
export type CountryId = (typeof COUNTRY_IDS)[number]

export const RESOURCES = ['food', 'industry', 'fuel', 'capital'] as const
export type Resource = (typeof RESOURCES)[number]
export type ResourceBag = Record<Resource, number>
export type ContributionKey = Resource | 'military'

export type GameMode = 'solo' | 'hotseat'
export type GamePhase = 'briefing' | 'cabinet' | 'crisis' | 'summit' | 'aftermath' | 'ended'
export type Controller = 'human' | 'ai'

export function isActionPhase(phase: GamePhase): phase is 'cabinet' | 'crisis' | 'summit' {
  return phase === 'cabinet' || phase === 'crisis' || phase === 'summit'
}

export type CountryState = {
  id: CountryId
  resources: ResourceBag
  civilianPopulation: number
  military: number
  signed: boolean
  underPressure: boolean
  mandateRevealed: boolean
  policyHand: string[]
  policyPlayed: string | null
}

export type TrustMap = Record<string, number>

export type Commitment = Partial<Record<ContributionKey, number>>

export type SummitOffer = {
  country: CountryId
  give: Resource
  want: Resource
}

export type CrisisResult = {
  crisisId: string
  succeeded: boolean
  totals: Commitment
  requirements: Commitment
  headline: string
  detail: string
}

export type LogEntry = {
  id: number
  round: number
  phase: GamePhase
  country?: CountryId
  message: string
}

export type Ending = {
  result: 'victory' | 'defeat'
  title: string
  reason: string
  epilogue: string
}

export type GameState = {
  version: '3.0'
  seed: number
  rngState: number
  playerCount: number
  mode: GameMode
  humanCountry: CountryId | null
  controllers: Record<CountryId, Controller>
  countryOrder: CountryId[]
  round: number
  maxRounds: number
  phase: GamePhase
  firstPlayer: CountryId
  activeCountry: CountryId
  countries: Record<CountryId, CountryState>
  globalUnrest: number
  peaceMomentum: number
  refugeePool: number
  trust: TrustMap
  crisisDeck: string[]
  currentCrisisId: string
  commitments: Partial<Record<CountryId, Commitment>>
  summitOffers: Partial<Record<CountryId, SummitOffer>>
  summitTurnsTaken: Partial<Record<CountryId, true>>
  lastCrisisResult: CrisisResult | null
  log: LogEntry[]
  ending: Ending | null
}

export type PolicyCard = {
  id: string
  title: string
  kicker: string
  description: string
  cost?: Partial<ResourceBag>
  gain?: Partial<ResourceBag>
  civilianDelta?: number
  militaryDelta?: number
  unrestDelta?: number
  peaceDelta?: number
  refugeeDelta?: number
  requiresTarget?: boolean
  targetCivilianDelta?: number
  targetMilitaryDelta?: number
  trustDelta?: number
  revealMandate?: boolean
}

export type CrisisCard = {
  id: string
  title: string
  location: string
  briefing: string
  requirements: (playerCount: number) => Commitment
  success: {
    headline: string
    detail: string
    peace: number
    unrest: number
    refugees?: number
  }
  failure: {
    headline: string
    detail: string
    peace: number
    unrest: number
    refugees?: (playerCount: number) => number
    civilianLoss?: number
    militaryLoss?: number
  }
}

export type SetupOptions = {
  playerCount: number
  mode: GameMode
  humanCountry: CountryId
  seed: number
}

export type GameAction =
  | { type: 'ACKNOWLEDGE_BRIEFING' }
  | { type: 'PLAY_POLICY'; country: CountryId; cardId: string; target?: CountryId }
  | { type: 'CONSERVE_RESOURCES'; country: CountryId }
  | { type: 'SUBMIT_COMMITMENT'; country: CountryId; commitment: Commitment }
  | { type: 'POST_OFFER'; country: CountryId; give: Resource; want: Resource }
  | { type: 'ACCEPT_OFFER'; country: CountryId; offerCountry: CountryId }
  | { type: 'BUILD_TRUST'; country: CountryId; target: CountryId }
  | { type: 'SIGN_TREATY'; country: CountryId }
  | { type: 'PASS_SUMMIT'; country: CountryId }
  | { type: 'CONTINUE_ROUND' }

export function emptyBag(): ResourceBag {
  return { food: 0, industry: 0, fuel: 0, capital: 0 }
}
