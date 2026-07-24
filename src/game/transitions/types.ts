import type { GameAction } from '../types'

export type ActionOf<Type extends GameAction['type']> = Extract<GameAction, { type: Type }>
