import { Flame, Handshake, TentTree } from 'lucide-react'
import type { GameState } from '../game/types'

type TrackProps = {
  icon: React.ReactNode
  label: string
  value: number
  max: number
  note: string
  tone: string
}

function Track({ icon, label, value, max, note, tone }: TrackProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={`shared-track track-${tone}`}>
      <div className="track-icon" aria-hidden="true">{icon}</div>
      <div className="track-copy">
        <div className="track-topline"><span>{label}</span><strong>{value}<small>/{max}</small></strong></div>
        <div className="track-meter" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <small>{note}</small>
      </div>
    </div>
  )
}

export function SharedTracks({ state }: { state: GameState }) {
  return (
    <section className="shared-tracks" aria-label="Shared tracks">
      <Track icon={<Handshake size={20} />} label="Peace momentum" value={state.peaceMomentum} max={10} note={state.peaceMomentum >= 6 ? 'Treaty threshold reached' : `${6 - state.peaceMomentum} to unlock signatures`} tone="peace" />
      <Track icon={<Flame size={20} />} label="Global unrest" value={state.globalUnrest} max={10} note={state.globalUnrest >= 8 ? 'Collapse is close' : '10 ends the conference'} tone="unrest" />
      <Track icon={<TentTree size={20} />} label="Refugees" value={state.refugeePool} max={5 * state.playerCount} note={`${5 * state.playerCount} is the safe limit`} tone="refugees" />
    </section>
  )
}
