import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameAction, GameState } from './types'

vi.mock('./reducer', () => ({
  reduceGame: vi.fn((state: GameState) => state),
}))

vi.mock('./ai/cabinet', () => ({
  chooseAiPolicy: vi.fn(
    (state: GameState): GameAction => ({
      type: 'CONSERVE_RESOURCES',
      country: state.activeCountry,
    }),
  ),
}))

vi.mock('./ai/crisis', () => ({
  chooseAiCommitment: vi.fn(),
}))

vi.mock('./ai/summit', () => ({
  chooseAiSummitAction: vi.fn(),
}))

import { chooseAiPolicy } from './ai/cabinet'
import { runAiUntilHumanOrPause } from './ai/orchestrator'
import { setupGame } from './setup'

function loopingState(): GameState {
  const state = setupGame({
    playerCount: 2,
    seed: 148802,
    mode: 'hotseat',
    humanCountry: 'aravell',
  })
  state.phase = 'cabinet'
  state.activeCountry = 'aravell'
  state.controllers.aravell = 'ai'
  return state
}

describe('AI orchestration defensive stops', () => {
  beforeEach(() => {
    vi.mocked(chooseAiPolicy).mockImplementation(
      (state): GameAction => ({
        type: 'CONSERVE_RESOURCES',
        country: state.activeCountry,
      }),
    )
  })

  it('stops if an action phase unexpectedly has no AI action', () => {
    vi.mocked(chooseAiPolicy).mockReturnValueOnce(null as unknown as GameAction)
    const state = loopingState()
    expect(runAiUntilHumanOrPause(state)).toBe(state)
  })

  it('throws if mocked transitions cannot make progress', () => {
    expect(() => runAiUntilHumanOrPause(loopingState())).toThrow('AI turn guard exceeded')
  })
})
