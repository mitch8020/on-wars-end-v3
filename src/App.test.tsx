// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { useGameSession as UseGameSession } from './session/useGameSession'
import { testGame } from './test/fixtures'

const sessionMock = vi.fn<() => ReturnType<typeof UseGameSession>>()

vi.mock('./session/useGameSession', () => ({
  useGameSession: () => sessionMock(),
}))

import App from './App'

function emptySession(): ReturnType<typeof UseGameSession> {
  return {
    game: null,
    savedGame: null,
    lockedFor: null,
    error: null,
    start: vi.fn(),
    resume: vi.fn(),
    dispatch: vi.fn(),
    newGame: vi.fn(),
    unlock: vi.fn(),
    dismissError: vi.fn(),
  }
}

describe('App', () => {
  beforeEach(() => {
    sessionMock.mockReset()
  })

  it('renders setup and exposes saved-game resume', () => {
    const session = emptySession()
    session.savedGame = testGame(2)
    sessionMock.mockReturnValue(session)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Resume table' }))
    expect(session.resume).toHaveBeenCalledOnce()
  })

  it('renders the game, error toast, and dismissal, then hides the error', () => {
    const session = emptySession()
    session.game = testGame(2)
    session.error = 'Test move failure.'
    sessionMock.mockReturnValue(session)
    const { rerender } = render(<App />)
    expect(screen.getByRole('alert')).toHaveTextContent('Test move failure.')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(session.dismissError).toHaveBeenCalledOnce()

    session.error = null
    rerender(<App />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
