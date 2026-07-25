// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupGame } from '../game/engine'
import { SAVE_KEY } from './gameStorage'
import { useGameSession } from './useGameSession'

describe('useGameSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts, saves, dispatches, locks, reports errors, unlocks, and resets hotseat play', async () => {
    const { result } = renderHook(() => useGameSession())

    expect(result.current.savedGame).toBeNull()
    act(() => {
      result.current.resume()
      result.current.dispatch({ type: 'ACKNOWLEDGE_BRIEFING' })
    })
    expect(result.current.game).toBeNull()

    act(() => {
      result.current.start({
        playerCount: 2,
        mode: 'hotseat',
        humanCountry: 'aravell',
        seed: 148802,
      })
    })
    expect(result.current.game?.phase).toBe('briefing')
    expect(result.current.lockedFor).toBeNull()
    await waitFor(() => expect(window.localStorage.getItem(SAVE_KEY)).not.toBeNull())

    act(() => {
      result.current.dispatch({ type: 'ACKNOWLEDGE_BRIEFING' })
    })
    expect(result.current.game?.phase).toBe('cabinet')
    expect(result.current.lockedFor).toBe(result.current.game?.activeCountry)

    act(() => result.current.unlock())
    expect(result.current.lockedFor).toBeNull()

    act(() => {
      result.current.dispatch({ type: 'ACKNOWLEDGE_BRIEFING' })
    })
    expect(result.current.error).toContain('no briefing')
    act(() => result.current.dismissError())
    expect(result.current.error).toBeNull()

    act(() => result.current.newGame())
    expect(result.current.game).toBeNull()
    expect(result.current.savedGame).toBeNull()
    expect(result.current.lockedFor).toBeNull()
    expect(result.current.error).toBeNull()
    expect(window.localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('resumes hotseat action phases with a privacy lock', () => {
    const saved = setupGame({
      playerCount: 2,
      mode: 'hotseat',
      humanCountry: 'aravell',
      seed: 23,
    })
    saved.phase = 'cabinet'
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(saved))

    const { result } = renderHook(() => useGameSession())
    expect(result.current.savedGame).toEqual(saved)
    act(() => result.current.resume())
    expect(result.current.game).toEqual(saved)
    expect(result.current.lockedFor).toBe(saved.activeCountry)
  })

  it('resumes solo and non-action hotseat saves without a privacy lock', () => {
    const solo = setupGame({
      playerCount: 2,
      mode: 'solo',
      humanCountry: 'aravell',
      seed: 24,
    })
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(solo))
    const first = renderHook(() => useGameSession())
    act(() => first.result.current.resume())
    expect(first.result.current.game).toEqual(solo)
    expect(first.result.current.lockedFor).toBeNull()
    first.unmount()

    const hotseat = setupGame({
      playerCount: 2,
      mode: 'hotseat',
      humanCountry: 'aravell',
      seed: 25,
    })
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(hotseat))
    const second = renderHook(() => useGameSession())
    act(() => second.result.current.resume())
    expect(second.result.current.game).toEqual(hotseat)
    expect(second.result.current.lockedFor).toBeNull()
  })

  it('stages one AI action at a time and can skip the remaining envoy motion', () => {
    vi.useFakeTimers()
    const matchMedia = vi.fn().mockReturnValue({ matches: false } as MediaQueryList)
    vi.stubGlobal('matchMedia', matchMedia)
    const first = renderHook(() => useGameSession())
    act(() => {
      first.result.current.skipPresentation()
      first.result.current.start({
        playerCount: 2,
        mode: 'solo',
        humanCountry: 'tomerin',
        seed: 148802,
      })
    })
    act(() => {
      first.result.current.dispatch({ type: 'ACKNOWLEDGE_BRIEFING' })
    })
    expect(first.result.current.isBusy).toBe(true)
    expect(first.result.current.presentation).toMatchObject({
      kind: 'ai-turn',
      country: 'aravell',
    })
    act(() => vi.advanceTimersByTime(760))
    expect(first.result.current.game?.activeCountry).toBe('tomerin')
    expect(first.result.current.isBusy).toBe(false)
    first.unmount()

    const second = renderHook(() => useGameSession())
    act(() => {
      second.result.current.start({
        playerCount: 2,
        mode: 'solo',
        humanCountry: 'tomerin',
        seed: 148802,
      })
    })
    act(() => {
      second.result.current.dispatch({ type: 'ACKNOWLEDGE_BRIEFING' })
    })
    expect(second.result.current.isBusy).toBe(true)
    act(() => second.result.current.skipPresentation())
    expect(second.result.current.game?.activeCountry).toBe('tomerin')
    expect(second.result.current.isBusy).toBe(false)
    second.unmount()

    matchMedia.mockReturnValue({ matches: true } as MediaQueryList)
    const reduced = renderHook(() => useGameSession())
    act(() => {
      reduced.result.current.start({
        playerCount: 2,
        mode: 'solo',
        humanCountry: 'tomerin',
        seed: 148802,
      })
    })
    act(() => {
      reduced.result.current.dispatch({ type: 'ACKNOWLEDGE_BRIEFING' })
    })
    act(() => {
      vi.runAllTimers()
    })
    expect(reduced.result.current.game?.activeCountry).toBe('tomerin')
    reduced.unmount()
  })

  it('does not skip presentation for a hotseat table', () => {
    const { result } = renderHook(() => useGameSession())
    act(() => {
      result.current.start({
        playerCount: 2,
        mode: 'hotseat',
        humanCountry: 'aravell',
        seed: 2,
      })
    })
    const before = result.current.game
    act(() => result.current.skipPresentation())
    expect(result.current.game).toBe(before)
  })
})
