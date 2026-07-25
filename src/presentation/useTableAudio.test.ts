// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameState } from '../game/types'
import { testGame } from '../test/fixtures'
import { AUDIO_PREFERENCE_KEY, playTableSound, useTableAudio } from './useTableAudio'

class MockAudioContext {
  static instances: MockAudioContext[] = []

  currentTime = 2
  destination = {}
  close = vi.fn()
  oscillator = {
    type: 'sine',
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn((_event: string, listener: () => void) => listener()),
  }
  gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }

  constructor() {
    MockAudioContext.instances.push(this)
  }

  createOscillator() {
    return this.oscillator
  }

  createGain() {
    return this.gain
  }
}

const AudioContextConstructor = MockAudioContext as unknown as typeof AudioContext

function nextState(state: GameState, update: (next: GameState) => void) {
  const next = structuredClone(state)
  update(next)
  return next
}

describe('table audio', () => {
  beforeEach(() => {
    localStorage.clear()
    MockAudioContext.instances = []
    vi.stubGlobal('AudioContext', AudioContextConstructor)
  })

  it('synthesizes every subtle table cue and safely handles unavailable audio', () => {
    vi.stubGlobal('AudioContext', undefined)
    playTableSound('paper')
    expect(MockAudioContext.instances).toHaveLength(0)
    vi.stubGlobal('AudioContext', AudioContextConstructor)

    for (const sound of ['paper', 'card', 'marker', 'stamp'] as const) {
      playTableSound(sound, AudioContextConstructor)
    }

    expect(MockAudioContext.instances).toHaveLength(4)
    expect(MockAudioContext.instances[0].oscillator.type).toBe('triangle')
    expect(MockAudioContext.instances[1].oscillator.type).toBe('triangle')
    expect(MockAudioContext.instances[2].oscillator.type).toBe('sine')
    expect(MockAudioContext.instances[3].oscillator.type).toBe('sine')
    for (const context of MockAudioContext.instances) {
      expect(context.oscillator.start).toHaveBeenCalledOnce()
      expect(context.oscillator.stop).toHaveBeenCalledOnce()
      expect(context.gain.connect).toHaveBeenCalledWith(context.destination)
      expect(context.close).toHaveBeenCalledOnce()
    }
  })

  it('persists the sound preference and cues signatures, phases, and moves', async () => {
    localStorage.setItem(AUDIO_PREFERENCE_KEY, 'on')
    const first = testGame(2)
    const { result, rerender } = renderHook(
      ({ state }: { state: GameState }) => useTableAudio(state),
      { initialProps: { state: first } },
    )
    expect(result.current.enabled).toBe(true)
    expect(MockAudioContext.instances).toHaveLength(0)

    const signed = nextState(first, (state) => {
      state.countries.aravell.signed = true
    })
    rerender({ state: signed })
    await waitFor(() => expect(MockAudioContext.instances).toHaveLength(1))

    const cabinet = nextState(signed, (state) => {
      state.phase = 'cabinet'
    })
    rerender({ state: cabinet })
    await waitFor(() => expect(MockAudioContext.instances).toHaveLength(2))

    const crisis = nextState(cabinet, (state) => {
      state.phase = 'crisis'
    })
    rerender({ state: crisis })
    await waitFor(() => expect(MockAudioContext.instances).toHaveLength(3))

    const moved = nextState(crisis, (state) => {
      state.log.push({ id: 99, round: 1, phase: 'crisis', message: 'A marker moves.' })
    })
    rerender({ state: moved })
    await waitFor(() => expect(MockAudioContext.instances).toHaveLength(4))
    rerender({ state: moved })
    expect(MockAudioContext.instances).toHaveLength(4)
    rerender({ state: structuredClone(moved) })
    expect(MockAudioContext.instances).toHaveLength(4)

    act(() => result.current.toggle())
    expect(result.current.enabled).toBe(false)
    expect(localStorage.getItem(AUDIO_PREFERENCE_KEY)).toBe('off')
    act(() => result.current.toggle())
    expect(result.current.enabled).toBe(true)
    expect(localStorage.getItem(AUDIO_PREFERENCE_KEY)).toBe('on')
    expect(MockAudioContext.instances).toHaveLength(5)
  })
})
