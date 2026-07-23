import type { GameAction, GameState } from '../../game/types'

export type PhaseActionsProps = {
  state: GameState
  onAction: (action: GameAction) => void
}
