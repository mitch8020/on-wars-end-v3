// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addCrisisResult, addEnding, testGame } from '../test/fixtures'
import { GameTable } from './GameTable'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('GameTable', () => {
  it('opens reference drawers and confirms before abandoning an active table', () => {
    const state = testGame(2)
    state.mode = 'solo'
    state.humanCountry = 'aravell'
    const onNewGame = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={vi.fn()}
        onAction={vi.fn()}
        onNewGame={onNewGame}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Aravell' })).toBeInTheDocument()
    expect(screen.queryByText(/has the floor/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Guide/ }))
    expect(screen.getByRole('heading', { name: 'How peace is made' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }))
    fireEvent.click(screen.getByRole('button', { name: /Minutes/ }))
    expect(screen.getByRole('heading', { name: 'Conference minutes' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }))

    fireEvent.click(screen.getByRole('button', { name: /New table/ }))
    expect(onNewGame).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /New table/ }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(onNewGame).toHaveBeenCalledOnce()
  })

  it('renders action seats, phase progress, hotseat privacy, and every round phase', () => {
    const state = testGame(3)
    state.phase = 'cabinet'
    state.activeCountry = 'tomerin'
    const onUnlock = vi.fn()
    const { rerender } = render(
      <GameTable
        state={state}
        lockedFor="tomerin"
        onUnlock={onUnlock}
        onAction={vi.fn()}
        onNewGame={vi.fn()}
      />,
    )
    expect(screen.getByText(/Tomerin has the floor/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /I am Tomerin/ }))
    expect(onUnlock).toHaveBeenCalledOnce()

    state.phase = 'crisis'
    rerender(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={onUnlock}
        onAction={vi.fn()}
        onNewGame={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Seal your commitment' })).toBeInTheDocument()

    state.phase = 'summit'
    rerender(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={onUnlock}
        onAction={vi.fn()}
        onNewGame={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Make one diplomatic move' })).toBeInTheDocument()

    state.phase = 'aftermath'
    addCrisisResult(state, true)
    rerender(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={onUnlock}
        onAction={vi.fn()}
        onNewGame={vi.fn()}
      />,
    )
    expect(screen.getByText('The table holds')).toBeInTheDocument()
    expect(document.querySelectorAll('.phase-nav .complete')).toHaveLength(3)
  })

  it('reviews and restores the ending, then starts over without confirmation', () => {
    const state = testGame(2)
    addEnding(state, 'defeat')
    const onNewGame = vi.fn()
    const confirm = vi.spyOn(window, 'confirm')
    render(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={vi.fn()}
        onAction={vi.fn()}
        onNewGame={onNewGame}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Peace failed' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Current action')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Review final table/ }))
    expect(screen.queryByRole('heading', { name: 'Peace failed' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review outcome' }))
    expect(screen.getByRole('heading', { name: 'Peace failed' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /New table/ }))
    expect(confirm).not.toHaveBeenCalled()
    expect(onNewGame).toHaveBeenCalledOnce()
  })

  it('uses the first player for a non-action hotseat view', () => {
    const state = testGame(2)
    state.phase = 'briefing'
    state.humanCountry = null
    render(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={vi.fn()}
        onAction={vi.fn()}
        onNewGame={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: /Aravell|Tomerin/ })).toBeInTheDocument()
  })

  it('opens responsive folios, changes the viewed delegation, and toggles sound', () => {
    localStorage.setItem('on-wars-end-v3:table-audio', 'on')
    const state = testGame(2)
    state.phase = 'cabinet'
    state.humanCountry = 'aravell'
    const { rerender } = render(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={vi.fn()}
        onAction={vi.fn()}
        onNewGame={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Crisis dispatch' }))
    expect(screen.getByRole('button', { name: 'Close crisis folio' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close crisis folio' }))
    fireEvent.click(screen.getByRole('button', { name: /Aravell folio/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Close delegation folio' }))
    fireEvent.click(screen.getByRole('button', { name: /Aravell folio/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Close table folio' }))

    fireEvent.click(screen.getByRole('button', { name: /View Tomerin/ }))
    expect(screen.getByRole('heading', { name: 'Tomerin' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tomerin folio/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mute table sounds' }))
    expect(screen.getByRole('button', { name: 'Enable table sounds' })).toBeInTheDocument()

    state.activeCountry = 'tomerin'
    rerender(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={vi.fn()}
        onAction={vi.fn()}
        onNewGame={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Tomerin' })).toBeInTheDocument()
  })

  it('replaces phase controls with an announced, skippable envoy turn', () => {
    const state = testGame(2)
    state.phase = 'cabinet'
    const skip = vi.fn()
    const { rerender } = render(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={vi.fn()}
        onAction={vi.fn()}
        onNewGame={vi.fn()}
        isBusy
        presentationMessage="Tomerin considers the room."
        onSkipPresentation={skip}
      />,
    )
    expect(screen.queryByRole('heading', { name: 'Choose one national policy' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Tomerin considers the room.')
    fireEvent.click(screen.getByRole('button', { name: 'Skip envoy motion' }))
    expect(skip).toHaveBeenCalledOnce()

    rerender(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={vi.fn()}
        onAction={vi.fn()}
        onNewGame={vi.fn()}
        isBusy
        presentationMessage="Tomerin considers the room."
      />,
    )
    expect(screen.queryByRole('button', { name: 'Skip envoy motion' })).not.toBeInTheDocument()

    rerender(
      <GameTable
        state={state}
        lockedFor={null}
        onUnlock={vi.fn()}
        onAction={vi.fn()}
        onNewGame={vi.fn()}
        isBusy
      />,
    )
    expect(screen.getByRole('heading', { name: 'Choose one national policy' })).toBeInTheDocument()
  })
})
