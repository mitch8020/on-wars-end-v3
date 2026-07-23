import { COUNTRY_DEFINITIONS, CRISIS_CARDS } from './data'
import { runInvariants } from './invariants'
import { nextRandom, shuffle } from './random'
import { trustKey } from './rules'
import { appendLog, clamp, dealPolicyHands } from './state'
import {
  COUNTRY_IDS,
  type CountryId,
  type CountryState,
  type GameState,
  type SetupOptions,
  type TrustMap,
} from './types'

function createTrustMap(countryOrder: CountryId[]): TrustMap {
  const trust: TrustMap = {}
  for (let first = 0; first < countryOrder.length; first += 1) {
    for (let second = first + 1; second < countryOrder.length; second += 1) {
      const firstCountry = countryOrder[first]
      const secondCountry = countryOrder[second]
      const naturalPartners =
        (firstCountry === 'aravell' && secondCountry === 'veyra') ||
        (firstCountry === 'tomerin' && secondCountry === 'namarra') ||
        (firstCountry === 'belovar' && secondCountry === 'karsk')
      trust[trustKey(firstCountry, secondCountry)] = naturalPartners ? 2 : 1
    }
  }
  return trust
}

function createCountry(id: CountryId): CountryState {
  const definition = COUNTRY_DEFINITIONS[id]
  return {
    id,
    resources: { ...definition.start },
    civilianPopulation: definition.civilianPopulation,
    military: definition.military,
    signed: false,
    underPressure: false,
    mandateRevealed: false,
    policyHand: [],
    policyPlayed: null,
  }
}

export function setupGame(options: SetupOptions): GameState {
  const playerCount = clamp(Math.round(options.playerCount), 2, 6)
  const countryOrder = COUNTRY_IDS.slice(0, playerCount) as CountryId[]
  const humanCountry = countryOrder.includes(options.humanCountry) ? options.humanCountry : countryOrder[0]
  const seed = (Math.abs(Math.round(options.seed)) || 1) >>> 0
  const [crisisIds, shuffledRngState] = shuffle(
    CRISIS_CARDS.map((crisis) => crisis.id),
    seed,
  )
  let rngState = shuffledRngState

  let firstPlayer: CountryId = 'aravell'
  if (playerCount > 2) {
    let random
    ;[random, rngState] = nextRandom(rngState)
    firstPlayer = countryOrder[Math.floor(random * countryOrder.length)]
  }

  const countries = Object.fromEntries(COUNTRY_IDS.map((id) => [id, createCountry(id)])) as Record<
    CountryId,
    CountryState
  >
  const controllers = Object.fromEntries(
    COUNTRY_IDS.map((id) => [id, options.mode === 'hotseat' || id === humanCountry ? 'human' : 'ai']),
  ) as GameState['controllers']

  const state: GameState = {
    version: '3.0',
    seed,
    rngState,
    playerCount,
    mode: options.mode,
    humanCountry: options.mode === 'solo' ? humanCountry : null,
    controllers,
    countryOrder,
    round: 1,
    maxRounds: 6,
    phase: 'briefing',
    firstPlayer,
    activeCountry: firstPlayer,
    countries,
    globalUnrest: 3,
    peaceMomentum: 1,
    refugeePool: 2 * playerCount,
    trust: createTrustMap(countryOrder),
    crisisDeck: crisisIds.slice(1),
    currentCrisisId: crisisIds[0],
    commitments: {},
    summitOffers: {},
    summitTurnsTaken: {},
    lastCrisisResult: null,
    log: [],
    ending: null,
  }
  dealPolicyHands(state)
  appendLog(state, `${COUNTRY_DEFINITIONS[firstPlayer].name} will open the first cabinet session.`)
  runInvariants(state)
  return state
}
