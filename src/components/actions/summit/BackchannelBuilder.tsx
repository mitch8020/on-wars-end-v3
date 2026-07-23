import { COUNTRY_DEFINITIONS } from '../../../game/data'
import { getTrust } from '../../../game/engine'
import type { CountryId, GameState } from '../../../game/types'

type BackchannelBuilderProps = {
  state: GameState
  country: CountryId
  target: CountryId
  onTargetChange: (country: CountryId) => void
}

export function BackchannelBuilder({
  state,
  country,
  target,
  onTargetChange,
}: BackchannelBuilderProps) {
  return (
    <div className="backchannel-builder">
      <p>Spend 1 Capital to build 2 Trust, reveal a country’s mandate, and gain 1 Peace Momentum.</p>
      <div className="partner-grid">
        {state.countryOrder
          .filter((candidate) => candidate !== country)
          .map((candidate) => (
            <button
              type="button"
              key={candidate}
              className={target === candidate ? 'selected' : ''}
              onClick={() => onTargetChange(candidate)}
            >
              <span style={{ background: COUNTRY_DEFINITIONS[candidate].color }}>
                {COUNTRY_DEFINITIONS[candidate].monogram}
              </span>
              <strong>{COUNTRY_DEFINITIONS[candidate].name}</strong>
              <small>Trust {getTrust(state, country, candidate)}/4</small>
            </button>
          ))}
      </div>
    </div>
  )
}
