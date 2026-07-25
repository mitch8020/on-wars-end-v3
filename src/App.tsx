import { CircleAlert, X } from 'lucide-react'
import { GameTable } from './components/GameTable'
import { SetupScreen } from './components/SetupScreen'
import { useGameSession } from './session/useGameSession'

export default function App() {
  const session = useGameSession()

  if (!session.game) {
    return (
      <SetupScreen
        onStart={session.start}
        hasSavedGame={Boolean(session.savedGame)}
        onResume={session.resume}
      />
    )
  }

  return (
    <>
      <GameTable
        state={session.game}
        lockedFor={session.lockedFor}
        onUnlock={session.unlock}
        onAction={session.dispatch}
        onNewGame={session.newGame}
        isBusy={session.isBusy}
        presentationMessage={session.presentation?.message}
        onSkipPresentation={session.skipPresentation}
      />
      {session.error && (
        <div className="error-toast" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>
            <strong>Move not completed</strong>
            {session.error}
          </span>
          <button type="button" onClick={session.dismissError} aria-label="Dismiss error">
            <X />
          </button>
        </div>
      )}
    </>
  )
}
