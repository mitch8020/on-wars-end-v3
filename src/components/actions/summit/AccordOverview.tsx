import { ArrowRightLeft, CircleOff, Sparkles } from 'lucide-react'
import { COUNTRY_DEFINITIONS, RESOURCE_META } from '../../../game/data'
import type { SigningStatus } from '../../../game/engine'
import type { CountryId, GameState } from '../../../game/types'

type AccordOverviewProps = {
  state: GameState
  country: CountryId
  signing: SigningStatus
  onAccept: (offerCountry: CountryId) => void
}

export function AccordOverview({ state, country, signing, onAccept }: AccordOverviewProps) {
  const availableOffers = state.countryOrder
    .map((candidate) => state.summitOffers[candidate])
    .filter((offer) => offer && offer.country !== country)

  return (
    <div className="accord-overview">
      <div className={`signing-status ${signing.eligible ? 'ready' : ''}`}>
        <span className="accord-seal">{signing.eligible ? <Sparkles /> : <CircleOff />}</span>
        <div>
          <strong>{signing.eligible ? 'Your delegation can sign' : 'Your delegation is not ready'}</strong>
          {signing.eligible ? (
            <p>The mandate, red line, Peace, and Trust requirements are all met.</p>
          ) : (
            <ul>
              {signing.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {availableOffers.length > 0 && (
        <div className="proposal-list">
          <span>Proposals on the table</span>
          {availableOffers.map(
            (offer) =>
              offer && (
                <button
                  type="button"
                  key={offer.country}
                  disabled={state.countries[country].resources[offer.want] < 1}
                  onClick={() => onAccept(offer.country)}
                >
                  <span className="proposal-country">{COUNTRY_DEFINITIONS[offer.country].monogram}</span>
                  <strong>{COUNTRY_DEFINITIONS[offer.country].name}</strong>
                  <span>
                    gives <b>{RESOURCE_META[offer.give].label}</b>
                  </span>
                  <ArrowRightLeft size={14} />
                  <span>
                    wants <b>{RESOURCE_META[offer.want].label}</b>
                  </span>
                  <em>Accept</em>
                </button>
              ),
          )}
        </div>
      )}
    </div>
  )
}
