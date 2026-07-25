import { useEffect, useState } from 'react'
import { chooseAiAction, describeAi, runAiUntilHumanOrPause } from '../game/ai'
import { reduceGame, setupGame } from '../game/engine'
import { isActionPhase, type CountryId, type GameAction, type GameState, type SetupOptions } from '../game/types'
import { clearSavedGame, readSavedGame, writeSavedGame } from './gameStorage'

export type PresentationEvent = {
  kind: 'ai-turn'
  country: CountryId
  message: string
}

function getHotseatLock(state: GameState): CountryId | null {
  return state.mode === 'hotseat' && isActionPhase(state.phase) ? state.activeCountry : null
}

function motionDelay() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 760
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

  useEffect(() => {
    if (
      !game ||
      game.mode !== 'solo' ||
      game.ending ||
      !isActionPhase(game.phase) ||
      game.controllers[game.activeCountry] !== 'ai'
    ) {
      return
    }

    const action = chooseAiAction(game)!
    const timer = window.setTimeout(() => {
      try {
        setGame(reduceGame(game, action))
        setError(null)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'That envoy move could not be completed.')
      }
    }, motionDelay())
    return () => window.clearTimeout(timer)
  }, [game])

  const start = (options: SetupOptions) => {
    setGame(setupGame(options))
    setLockedFor(null)
    setError(null)
  }

  const resume = () => {
    if (!savedGame) return
    setGame(savedGame)
    setLockedFor(getHotseatLock(savedGame))
  }

  const dispatch = (action: GameAction) => {
    if (!game) return
    try {
      const next = reduceGame(game, action)
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

  const skipPresentation = () => {
    if (!game || game.mode !== 'solo') return
    const next = runAiUntilHumanOrPause(game)
    setGame(next)
    setError(null)
  }

  const aiIsMoving = Boolean(
    game &&
      game.mode === 'solo' &&
      !game.ending &&
      isActionPhase(game.phase) &&
      game.controllers[game.activeCountry] === 'ai',
  )
  const presentation: PresentationEvent | null =
    game && aiIsMoving
      ? {
          kind: 'ai-turn',
          country: game.activeCountry,
          message: describeAi(game, game.activeCountry),
        }
      : null

  return {
    game,
    savedGame,
    lockedFor,
    error,
    presentation,
    isBusy: aiIsMoving,
    start,
    resume,
    dispatch,
    newGame,
    skipPresentation,
    unlock: () => setLockedFor(null),
    dismissError: () => setError(null),
  }
}
