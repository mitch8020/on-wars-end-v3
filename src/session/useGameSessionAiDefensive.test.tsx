// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ thrown: new Error('envoy failed') as unknown }))

vi.mock('../game/engine', async (importOriginal) => {
  const original = await importOriginal<typeof import('../game/engine')>()
  return {
    ...original,
    reduceGame: vi.fn((state, action) => {
      if (action.type === 'ACKNOWLEDGE_BRIEFING') return original.reduceGame(state, action)
      throw mocks.thrown
    }),
  }
})

import { useGameSession } from './useGameSession'

describe('useGameSession defensive AI pacing', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true } as MediaQueryList)))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function beginAiTurn() {
    const hook = renderHook(() => useGameSession())
    act(() => {
      hook.result.current.start({
        playerCount: 2,
        mode: 'solo',
        humanCountry: 'tomerin',
        seed: 148802,
      })
    })
    act(() => hook.result.current.dispatch({ type: 'ACKNOWLEDGE_BRIEFING' }))
    act(() => vi.runAllTimers())
    return hook
  }

  it('reports an Error thrown by an envoy action', () => {
    mocks.thrown = new Error('envoy failed')
    const hook = beginAiTurn()
    expect(hook.result.current.error).toBe('envoy failed')
  })

  it('uses a safe message for a non-Error envoy failure', () => {
    mocks.thrown = 'non-error envoy failure'
    const hook = beginAiTurn()
    expect(hook.result.current.error).toBe('That envoy move could not be completed.')
  })
})
