import { COUNTRY_DEFINITIONS, MAX_TRACK } from '../data'
import { runInvariants } from '../invariants'
import { isRedLineSafe } from '../rules'
import { appendLog, clamp } from '../state'
import type { CountryId, GameState } from '../types'

export function nextPendingCountry(
  state: GameState,
  completed: (country: CountryId) => boolean,
): CountryId | null {
  const start = state.countryOrder.indexOf(state.activeCountry)
  for (let offset = 1; offset <= state.countryOrder.length; offset += 1) {
    const candidate = state.countryOrder[(start + offset) % state.countryOrder.length]
    if (!completed(candidate)) return candidate
  }
  return null
}

function updatePressure(state: GameState): void {
  for (const country of state.countryOrder) {
    const safe = isRedLineSafe(state, country)
    const current = state.countries[country]
    if (!safe && !current.underPressure) {
      current.underPressure = true
      state.globalUnrest = clamp(state.globalUnrest + 1)
      appendLog(
        state,
        `${COUNTRY_DEFINITIONS[country].name} crosses a national red line. Global Unrest rises.`,
        country,
      )
    } else if (safe && current.underPressure) {
      current.underPressure = false
      appendLog(state, `${COUNTRY_DEFINITIONS[country].name} restores its national red line.`, country)
    }
  }
}

function getImmediateEnding(state: GameState): GameState['ending'] {
  const collapsed = state.countryOrder.find((country) => state.countries[country].civilianPopulation <= 0)
  if (collapsed) {
    return {
      result: 'defeat',
      title: 'A country collapses',
      reason: `${COUNTRY_DEFINITIONS[collapsed].name} has no Civilian Population left.`,
      epilogue:
        'A treaty cannot survive the disappearance of a state from the table. The remaining delegations leave before dawn.',
    }
  }

  const disarmed = state.countryOrder.find((country) => state.countries[country].military <= 0)
  if (disarmed) {
    return {
      result: 'defeat',
      title: 'The front breaks',
      reason: `${COUNTRY_DEFINITIONS[disarmed].name} has no Military left to hold the ceasefire line.`,
      epilogue:
        'One army dissolves before the signatures arrive. The vacuum draws every rival back toward the border.',
    }
  }

  if (state.globalUnrest >= MAX_TRACK) {
    return {
      result: 'defeat',
      title: 'The room loses the streets',
      reason: 'Global Unrest reached 10.',
      epilogue:
        'The radios fill with ultimatums. By the time the delegates agree on language, their governments no longer have permission to sign it.',
    }
  }

  if (state.refugeePool > 5 * state.playerCount) {
    return {
      result: 'defeat',
      title: 'The roads overflow',
      reason: `The Refugee Pool rose above ${5 * state.playerCount}.`,
      epilogue:
        'The conference becomes a footnote beside the largest movement of people the region has ever seen.',
    }
  }

  return null
}

export function finalizeTransition(state: GameState): GameState {
  updatePressure(state)
  const ending = getImmediateEnding(state)
  if (ending) {
    state.ending = ending
    state.phase = 'ended'
  }
  runInvariants(state)
  return state
}
