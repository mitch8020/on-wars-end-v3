import { appendLog } from '../state'
import type { GameState } from '../types'
import { finalizeTransition } from './lifecycle'

export function acknowledgeBriefing(state: GameState): GameState {
  if (state.phase !== 'briefing') throw new Error('There is no briefing to acknowledge.')
  state.phase = 'cabinet'
  state.activeCountry = state.firstPlayer
  appendLog(state, `Round ${state.round} cabinet planning begins.`)
  return finalizeTransition(state)
}
