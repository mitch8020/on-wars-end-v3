import { MAX_TRACK } from './data'
import { RESOURCES, type GameState } from './types'

export function runInvariants(state: GameState): void {
  if (state.version !== '3.0') throw new Error('Unsupported game-state version.')
  if (state.countryOrder.length !== state.playerCount) throw new Error('Player count and country order disagree.')
  if (new Set(state.countryOrder).size !== state.countryOrder.length) throw new Error('A country appears twice in the roster.')
  if (!state.countryOrder.includes(state.activeCountry)) throw new Error('The active country is not in play.')
  if (!state.countryOrder.includes(state.firstPlayer)) throw new Error('The first player is not in play.')
  if (state.globalUnrest < 0 || state.globalUnrest > MAX_TRACK) throw new Error('Global Unrest left its track.')
  if (state.peaceMomentum < 0 || state.peaceMomentum > MAX_TRACK) throw new Error('Peace Momentum left its track.')
  if (state.refugeePool < 0) throw new Error('The Refugee Pool became negative.')
  for (const country of state.countryOrder) {
    const current = state.countries[country]
    for (const resource of RESOURCES) {
      if (!Number.isInteger(current.resources[resource]) || current.resources[resource] < 0) {
        throw new Error(`${country} has an invalid ${resource} count.`)
      }
    }
    if (!Number.isInteger(current.civilianPopulation) || !Number.isInteger(current.military)) {
      throw new Error(`${country} has a fractional population track.`)
    }
  }
  for (const value of Object.values(state.trust)) {
    if (!Number.isInteger(value) || value < 0 || value > 4) throw new Error('A Trust edge left its track.')
  }
  if ((state.phase === 'ended') !== Boolean(state.ending)) throw new Error('Ended phase and ending record disagree.')
}
