// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SetupScreen } from './SetupScreen'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SetupScreen', () => {
  it('configures roster, mode, country, seed, resume, and game start', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.2)
    const onStart = vi.fn()
    const onResume = vi.fn()
    render(<SetupScreen onStart={onStart} hasSavedGame onResume={onResume} />)

    expect(screen.getByDisplayValue('190000')).toBeInTheDocument()
    expect(screen.getByText('Choose your country')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '6' }))
    fireEvent.click(screen.getByRole('button', { name: /Namarra/ }))
    expect(screen.getByRole('button', { name: /Namarra/ })).toHaveClass('selected')

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.queryByRole('button', { name: /Namarra/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aravell/ })).toHaveClass('selected')
    fireEvent.click(screen.getByRole('button', { name: '3' }))

    fireEvent.click(screen.getByRole('button', { name: /Pass & play/ }))
    expect(screen.getByText('Countries in play')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aravell/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Solo envoy/ }))
    expect(screen.getByRole('button', { name: /Aravell/ })).toBeEnabled()

    const seed = screen.getByRole('textbox', { name: 'Dispatch code' })
    fireEvent.change(seed, { target: { value: 'abc' } })
    expect(seed).toHaveValue('1')
    fireEvent.change(seed, { target: { value: '123456789012' } })
    expect(seed).toHaveValue('123456789')
    fireEvent.click(screen.getByRole('button', { name: 'Roll a new dispatch code' }))
    expect(seed).toHaveValue('280000')

    fireEvent.click(screen.getByRole('button', { name: 'Resume table' }))
    expect(onResume).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Convene the table' }))
    expect(onStart).toHaveBeenCalledWith({
      playerCount: 3,
      mode: 'solo',
      humanCountry: 'aravell',
      seed: 280000,
    })
  })

  it('omits resume when no saved game exists and starts pass-and-play', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const onStart = vi.fn()
    render(<SetupScreen onStart={onStart} hasSavedGame={false} onResume={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Resume table' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Pass & play/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Convene the table' }))
    expect(onStart).toHaveBeenCalledWith({
      playerCount: 4,
      mode: 'hotseat',
      humanCountry: 'aravell',
      seed: 100000,
    })
  })
})
