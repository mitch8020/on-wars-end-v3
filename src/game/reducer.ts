import { cloneGameState } from './state'
import { continueRound } from './transitions/aftermath'
import { acknowledgeBriefing } from './transitions/briefing'
import { conserveResources, playPolicy } from './transitions/cabinet'
import { submitCommitment } from './transitions/crisis'
import {
  acceptOffer,
  buildTrust,
  passSummit,
  postOffer,
  signTreaty,
} from './transitions/summit'
import type { GameAction, GameState } from './types'

export function reduceGame(state: GameState, action: GameAction): GameState {
  if (state.ending) throw new Error('The game has already ended.')
  const next = cloneGameState(state)

  switch (action.type) {
    case 'ACKNOWLEDGE_BRIEFING':
      return acknowledgeBriefing(next)
    case 'PLAY_POLICY':
      return playPolicy(next, action)
    case 'CONSERVE_RESOURCES':
      return conserveResources(next, action)
    case 'SUBMIT_COMMITMENT':
      return submitCommitment(next, action)
    case 'POST_OFFER':
      return postOffer(next, action)
    case 'ACCEPT_OFFER':
      return acceptOffer(next, action)
    case 'BUILD_TRUST':
      return buildTrust(next, action)
    case 'SIGN_TREATY':
      return signTreaty(next, action)
    case 'PASS_SUMMIT':
      return passSummit(next, action)
    case 'CONTINUE_ROUND':
      return continueRound(next)
  }
}
