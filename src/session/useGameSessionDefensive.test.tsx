// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '../game/types'

vi.mock('../game/engine', async (importOriginal) => {
  const original = await importOriginal<typeof import('../game/engine')>()
  return {
    ...original,
    reduceGame: vi.fn(() => {
      throw 'non-error rejection'
    }),
  }
})

import { useGameSession } from './useGameSession'

describe('useGameSession defensive dispatch error', () => {
  beforeEach(() => window.localStorage.clear())

  it('uses a safe message when a transition throws a non-Error value', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => {
      result.current.start({
        playerCount: 2,
        mode: 'hotseat',
        humanCountry: 'aravell',
        seed: 1,
      })
    })
    expect(result.current.game).not.toBeNull()
    act(() => {
      result.current.dispatch({ type: 'ACKNOWLEDGE_BRIEFING' })
    })
    expect(result.current.error).toBe('That move could not be completed.')
    expect(result.current.game as GameState | null).not.toBeNull()
  })
})
