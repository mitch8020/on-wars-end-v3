import { setupGame } from '../game/engine'
import { trustKey } from '../game/rules'
import { RESOURCES, type CountryId, type GamePhase, type GameState } from '../game/types'

export function testGame(playerCount = 3): GameState {
  return setupGame({
    playerCount,
    seed: 148802,
    mode: 'hotseat',
    humanCountry: 'aravell',
  })
}

export function gameInPhase(phase: GamePhase, playerCount = 3): GameState {
  const state = testGame(playerCount)
  state.phase = phase
  state.activeCountry = state.firstPlayer
  return state
}

export function makeCountryEligible(state: GameState, country: CountryId): void {
  const current = state.countries[country]
  for (const resource of RESOURCES) current.resources[resource] = 10
  current.civilianPopulation = 10
  current.military = 10
  current.underPressure = false
  state.globalUnrest = 0
  state.peaceMomentum = 10
  state.refugeePool = 0
  for (const other of state.countryOrder) {
    if (other !== country) state.trust[trustKey(country, other)] = 4
  }
}

export function addCrisisResult(state: GameState, succeeded: boolean): void {
  state.lastCrisisResult = {
    crisisId: state.currentCrisisId,
    succeeded,
    totals: succeeded ? { food: 4 } : {},
    requirements: { food: 4 },
    headline: succeeded ? 'The table holds' : 'The table fractures',
    detail: succeeded ? 'Relief arrives.' : 'Relief is delayed.',
  }
}

export function addEnding(state: GameState, result: 'victory' | 'defeat'): void {
  state.ending = {
    result,
    title: result === 'victory' ? 'Peace secured' : 'Peace failed',
    reason: 'Test ending reason.',
    epilogue: 'Test ending epilogue.',
  }
  state.phase = 'ended'
}
