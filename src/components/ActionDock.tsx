import type { GameAction, GameState } from '../game/types'
import { AftermathActions } from './actions/AftermathActions'
import { BriefingActions } from './actions/BriefingActions'
import { CabinetActions } from './actions/CabinetActions'
import { CrisisActions } from './actions/CrisisActions'
import { SummitActions } from './actions/SummitActions'

type ActionDockProps = {
  state: GameState
  onAction: (action: GameAction) => void
}

export function ActionDock(props: ActionDockProps) {
  const key = `${props.state.round}-${props.state.phase}-${props.state.activeCountry}`
  return (
    <section className={`action-dock phase-${props.state.phase}`} aria-label="Current action" key={key}>
      {props.state.phase === 'briefing' && <BriefingActions {...props} />}
      {props.state.phase === 'cabinet' && <CabinetActions {...props} />}
      {props.state.phase === 'crisis' && <CrisisActions {...props} />}
      {props.state.phase === 'summit' && <SummitActions {...props} />}
      {props.state.phase === 'aftermath' && <AftermathActions {...props} />}
    </section>
  )
}
