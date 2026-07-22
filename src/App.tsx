import { CircleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GameTable } from './components/GameTable'
import { SetupScreen } from './components/SetupScreen'
import { runAiUntilHumanOrPause } from './game/ai'
import { reduceGame, runInvariants, setupGame } from './game/engine'
import type { CountryId, GameAction, GameState, SetupOptions } from './game/types'

const SAVE_KEY = 'on-wars-end-v3-save'

function readSavedGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as GameState
    runInvariants(state)
    return state
  } catch {
    localStorage.removeItem(SAVE_KEY)
    return null
  }
}

export default function App() {
  const [savedGame, setSavedGame] = useState<GameState | null>(readSavedGame)
  const [game, setGame] = useState<GameState | null>(null)
  const [lockedFor, setLockedFor] = useState<CountryId | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!game) return
    localStorage.setItem(SAVE_KEY, JSON.stringify(game))
  }, [game])

  const start = (options: SetupOptions) => {
    const next = setupGame(options)
    setGame(next)
    setLockedFor(null)
    setError(null)
  }

  const resume = () => {
    if (!savedGame) return
    let next = savedGame
    if (next.mode === 'solo') next = runAiUntilHumanOrPause(next)
    setGame(next)
    const actionPhase = next.phase === 'cabinet' || next.phase === 'crisis' || next.phase === 'summit'
    setLockedFor(next.mode === 'hotseat' && actionPhase ? next.activeCountry : null)
  }

  const dispatch = (action: GameAction) => {
    if (!game) return
    try {
      let next = reduceGame(game, action)
      if (next.mode === 'solo') next = runAiUntilHumanOrPause(next)
      const actionPhase = next.phase === 'cabinet' || next.phase === 'crisis' || next.phase === 'summit'
      setLockedFor(next.mode === 'hotseat' && actionPhase ? next.activeCountry : null)
      setGame(next)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That move could not be completed.')
    }
  }

  const newGame = () => {
    localStorage.removeItem(SAVE_KEY)
    setSavedGame(null)
    setGame(null)
    setLockedFor(null)
    setError(null)
  }

  if (!game) return <SetupScreen onStart={start} hasSavedGame={Boolean(savedGame)} onResume={resume} />

  return (
    <>
      <GameTable state={game} lockedFor={lockedFor} onUnlock={() => setLockedFor(null)} onAction={dispatch} onNewGame={newGame} />
      {error && (
        <div className="error-toast" role="alert">
          <CircleAlert aria-hidden="true" />
          <span><strong>Move not completed</strong>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error"><X /></button>
        </div>
      )}
    </>
  )
}
