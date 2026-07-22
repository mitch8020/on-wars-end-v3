import { Check, Eye, EyeOff, Gauge, ShieldAlert } from 'lucide-react'
import { COUNTRY_DEFINITIONS } from '../game/data'
import { averageTrust, getSigningStatus, isMandateMet } from '../game/engine'
import { RESOURCES, type CountryId, type GameState } from '../game/types'
import { ResourceMark } from './ResourceMark'

type CountryDossierProps = {
  state: GameState
  countryId: CountryId
  privateView: boolean
}

export function CountryDossier({ state, countryId, privateView }: CountryDossierProps) {
  const definition = COUNTRY_DEFINITIONS[countryId]
  const country = state.countries[countryId]
  const mandateVisible = privateView || country.mandateRevealed
  const signing = getSigningStatus(state, countryId)
  return (
    <aside className="country-dossier" style={{ '--country': definition.color, '--country-soft': definition.colorSoft } as React.CSSProperties} aria-labelledby="dossier-country">
      <div className="dossier-identity">
        <span className="country-sigil large">{definition.monogram}</span>
        <div>
          <p className="section-label">{state.controllers[countryId] === 'ai' ? 'AI envoy' : 'Your seat'}</p>
          <h2 id="dossier-country">{definition.name}</h2>
          <p>{definition.epithet}</p>
        </div>
        {country.signed && <span className="signed-chip"><Check size={14} /> Signed</span>}
      </div>
      <p className="country-brief">{definition.brief}</p>

      <div className="resource-grid">
        {RESOURCES.map((resource) => <ResourceMark key={resource} resource={resource} value={country.resources[resource]} compact />)}
        <ResourceMark resource="population" value={country.civilianPopulation} compact />
        <ResourceMark resource="military" value={country.military} compact />
      </div>

      <div className="mandate-card">
        <div className="mandate-title">
          {mandateVisible ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
          <span>National mandate</span>
          {mandateVisible && <i className={isMandateMet(state, countryId) ? 'status-dot met' : 'status-dot'} />}
        </div>
        {mandateVisible ? (
          <><strong>{definition.mandateTitle}</strong><p>{definition.mandate}</p></>
        ) : (
          <><strong>Classified by this delegation</strong><p>Build Trust or open archives to reveal what this country needs from peace.</p></>
        )}
      </div>

      <div className={`red-line ${country.underPressure ? 'breached' : ''}`}>
        <ShieldAlert size={15} aria-hidden="true" />
        <span><small>Red line</small>{mandateVisible ? definition.redLine : 'Classified'}</span>
        <strong>{country.underPressure ? 'Under pressure' : 'Secure'}</strong>
      </div>

      <div className="readiness-box">
        <div><Gauge size={15} /><span>Average Trust</span><strong>{averageTrust(state, countryId).toFixed(1)}<small>/4</small></strong></div>
        <div className={signing.eligible ? 'ready' : ''}><span>Treaty readiness</span><strong>{country.signed ? 'SIGNED' : signing.eligible ? 'READY' : 'NOT READY'}</strong></div>
      </div>
    </aside>
  )
}
