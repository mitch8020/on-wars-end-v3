import { describe, expect, it } from 'vitest'
import { setupGame } from '../game/engine'
import { SAVE_KEY, readSavedGame, writeSavedGame, type GameStorage } from './gameStorage'

function memoryStorage(): GameStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

describe('game storage', () => {
  it('round-trips a valid game state', () => {
    const storage = memoryStorage()
    const state = setupGame({ playerCount: 4, mode: 'solo', humanCountry: 'aravell', seed: 148802 })

    writeSavedGame(storage, state)

    expect(readSavedGame(storage)).toEqual(state)
  })

  it('discards a corrupt save instead of exposing it to the session', () => {
    const storage = memoryStorage()
    storage.setItem(SAVE_KEY, '{"version":"broken"}')

    expect(readSavedGame(storage)).toBeNull()
    expect(storage.getItem(SAVE_KEY)).toBeNull()
  })
})
