import { runInvariants } from '../game/engine'
import type { GameState } from '../game/types'

export const SAVE_KEY = 'on-wars-end-v3-save'

export type GameStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function readSavedGame(storage: GameStorage): GameState | null {
  try {
    const raw = storage.getItem(SAVE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as GameState
    runInvariants(state)
    return state
  } catch {
    storage.removeItem(SAVE_KEY)
    return null
  }
}

export function writeSavedGame(storage: GameStorage, state: GameState): void {
  storage.setItem(SAVE_KEY, JSON.stringify(state))
}

export function clearSavedGame(storage: GameStorage): void {
  storage.removeItem(SAVE_KEY)
}
