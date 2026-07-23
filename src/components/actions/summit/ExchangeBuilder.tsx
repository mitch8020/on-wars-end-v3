import { ArrowRightLeft } from 'lucide-react'
import { RESOURCE_META } from '../../../game/data'
import { RESOURCES, type CountryId, type GameState, type Resource } from '../../../game/types'

type ExchangeBuilderProps = {
  state: GameState
  country: CountryId
  give: Resource
  want: Resource
  onGiveChange: (resource: Resource) => void
  onWantChange: (resource: Resource) => void
}

export function ExchangeBuilder({
  state,
  country,
  give,
  want,
  onGiveChange,
  onWantChange,
}: ExchangeBuilderProps) {
  return (
    <div className="exchange-builder">
      <p>Post a public one-for-one proposal. It stays open until accepted or the round ends.</p>
      <div className="exchange-sides">
        <label>
          <span>You give</span>
          <select value={give} onChange={(event) => onGiveChange(event.target.value as Resource)}>
            {RESOURCES.map((resource) => (
              <option key={resource} value={resource}>
                {RESOURCE_META[resource].label} · {state.countries[country].resources[resource]} held
              </option>
            ))}
          </select>
        </label>
        <ArrowRightLeft aria-hidden="true" />
        <label>
          <span>You request</span>
          <select value={want} onChange={(event) => onWantChange(event.target.value as Resource)}>
            {RESOURCES.map((resource) => (
              <option key={resource} value={resource}>
                {RESOURCE_META[resource].label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
