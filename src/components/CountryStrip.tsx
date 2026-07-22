import { Bot, Check, UserRound } from 'lucide-react'
import { COUNTRY_DEFINITIONS } from '../game/data'
import { averageTrust, isMandateMet } from '../game/engine'
import type { GameState } from '../game/types'

export function CountryStrip({ state }: { state: GameState }) {
  return (
    <section className="country-strip" aria-label="Countries at the table">
      {state.countryOrder.map((countryId) => {
        const definition = COUNTRY_DEFINITIONS[countryId]
        const country = state.countries[countryId]
        const active = state.activeCountry === countryId && ['cabinet', 'crisis', 'summit'].includes(state.phase)
        const mandateVisible = country.mandateRevealed || active
        const mandateMet = mandateVisible && isMandateMet(state, countryId)
        return (
          <article key={countryId} className={`country-strip-card ${active ? 'active' : ''} ${country.underPressure ? 'pressured' : ''}`} style={{ '--country': definition.color } as React.CSSProperties}>
            <span className="strip-sigil">{definition.monogram}</span>
            <div><strong>{definition.name}</strong><small>{state.controllers[countryId] === 'ai' ? <><Bot size={11} /> AI envoy</> : <><UserRound size={11} /> Player</>}</small></div>
            <span className="strip-trust">T {averageTrust(state, countryId).toFixed(1)}</span>
            <span className={`strip-mandate ${mandateMet ? 'met' : ''}`}>{country.signed ? <Check size={13} /> : !mandateVisible ? 'classified' : mandateMet ? 'mandate met' : 'mandate open'}</span>
          </article>
        )
      })}
    </section>
  )
}
