import { useEffect, useState } from 'react'
import { runAiUntilHumanOrPause } from '../game/ai'
import { reduceGame, setupGame } from '../game/engine'
import { isActionPhase, type CountryId, type GameAction, type GameState, type SetupOptions } from '../game/types'
import { clearSavedGame, readSavedGame, writeSavedGame } from './gameStorage'

function advanceAutomatedTurns(state: GameState): GameState {
  return state.mode === 'solo' ? runAiUntilHumanOrPause(state) : state
}

function getHotseatLock(state: GameState): CountryId | null {
  return state.mode === 'hotseat' && isActionPhase(state.phase) ? state.activeCountry : null
}

export function useGameSession() {
  const storage = window.localStorage
  const [savedGame, setSavedGame] = useState<GameState | null>(() => readSavedGame(storage))
  const [game, setGame] = useState<GameState | null>(null)
  const [lockedFor, setLockedFor] = useState<CountryId | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (game) writeSavedGame(storage, game)
  }, [game, storage])

  const start = (options: SetupOptions) => {
    setGame(setupGame(options))
    setLockedFor(null)
    setError(null)
  }

  const resume = () => {
    if (!savedGame) return
    const next = advanceAutomatedTurns(savedGame)
    setGame(next)
    setLockedFor(getHotseatLock(next))
  }

  const dispatch = (action: GameAction) => {
    if (!game) return
    try {
      const next = advanceAutomatedTurns(reduceGame(game, action))
      setLockedFor(getHotseatLock(next))
      setGame(next)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That move could not be completed.')
    }
  }

  const newGame = () => {
    clearSavedGame(storage)
    setSavedGame(null)
    setGame(null)
    setLockedFor(null)
    setError(null)
  }

  return {
    game,
    savedGame,
    lockedFor,
    error,
    start,
    resume,
    dispatch,
    newGame,
    unlock: () => setLockedFor(null),
    dismissError: () => setError(null),
  }
}
