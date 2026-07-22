import { Check, LockKeyhole } from 'lucide-react'
import { COUNTRY_DEFINITIONS } from '../game/data'
import { getTrust } from '../game/engine'
import type { CountryId, GameState } from '../game/types'

type Point = { x: number; y: number }

function nodePositions(countries: CountryId[]): Record<CountryId, Point> {
  const entries = countries.map((country, index): [CountryId, Point] => {
    const angle = countries.length === 2 ? Math.PI + index * Math.PI : -Math.PI / 2 + (index * Math.PI * 2) / countries.length
    return [country, { x: 350 + Math.cos(angle) * 238, y: 245 + Math.sin(angle) * 168 }]
  })
  return Object.fromEntries(entries) as Record<CountryId, Point>
}

type TreatyWebProps = {
  state: GameState
}

export function TreatyWeb({ state }: TreatyWebProps) {
  const positions = nodePositions(state.countryOrder)
  const edges: { first: CountryId; second: CountryId; trust: number }[] = []
  for (let first = 0; first < state.countryOrder.length; first += 1) {
    for (let second = first + 1; second < state.countryOrder.length; second += 1) {
      const firstCountry = state.countryOrder[first]
      const secondCountry = state.countryOrder[second]
      edges.push({ first: firstCountry, second: secondCountry, trust: getTrust(state, firstCountry, secondCountry) })
    }
  }
  const signed = state.countryOrder.filter((country) => state.countries[country].signed).length
  const peacePercent = state.peaceMomentum * 10

  return (
    <section className="treaty-web-panel" aria-labelledby="treaty-web-title">
      <div className="panel-heading treaty-heading">
        <div>
          <p className="section-label">Live confidence map</p>
          <h2 id="treaty-web-title">The treaty web</h2>
        </div>
        <div className="web-legend" aria-label="Trust legend">
          <span><i className="legend-line trust-low" /> Fragile</span>
          <span><i className="legend-line trust-high" /> Credible</span>
        </div>
      </div>
      <div className="treaty-web-canvas">
        <svg viewBox="0 0 700 490" role="img" aria-labelledby="web-svg-title web-svg-desc">
          <title id="web-svg-title">Trust relationships between countries</title>
          <desc id="web-svg-desc">Lines become brighter and stronger as countries build trust. Signed countries display a check mark.</desc>
          <defs>
            <radialGradient id="tableGlow">
              <stop offset="0%" stopColor="#c3a268" stopOpacity=".1" />
              <stop offset="100%" stopColor="#c3a268" stopOpacity="0" />
            </radialGradient>
            <filter id="sealGlow" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <ellipse cx="350" cy="245" rx="300" ry="217" fill="url(#tableGlow)" />
          <path className="map-ghost" d="M95 210 159 126l92-25 52 38 83-39 98 43 109 92-31 96-88 56-85-24-76 32-94-45-75 17-48-71Z" />
          <path className="map-ghost-line" d="m159 126 87 87 57-74 10 134 73-173 7 161 91-118-55 190 133-2M144 367l102-154 67 182M219 350l94-77 76 90M96 296l150-83 183 120 164-98" />

          <g className="trust-edges">
            {edges.map(({ first, second, trust }) => (
              <line
                key={`${first}-${second}`}
                x1={positions[first].x}
                y1={positions[first].y}
                x2={positions[second].x}
                y2={positions[second].y}
                className={`trust-edge trust-${trust}`}
              >
                <title>{COUNTRY_DEFINITIONS[first].name} and {COUNTRY_DEFINITIONS[second].name}: Trust {trust} of 4</title>
              </line>
            ))}
          </g>

          <g className="peace-seal" transform="translate(350 245)">
            <circle r="72" className="seal-outer" />
            <circle r="57" className="seal-track" />
            <circle
              r="57"
              className="seal-progress"
              pathLength="100"
              strokeDasharray={`${peacePercent} ${100 - peacePercent}`}
              transform="rotate(-90)"
              filter={state.peaceMomentum >= 6 ? 'url(#sealGlow)' : undefined}
            />
            <text y="-18" className="seal-label">PEACE</text>
            <text y="17" className="seal-value">{state.peaceMomentum}</text>
            <text y="41" className="seal-caption">MOMENTUM</text>
          </g>

          {state.countryOrder.map((countryId) => {
            const definition = COUNTRY_DEFINITIONS[countryId]
            const country = state.countries[countryId]
            const point = positions[countryId]
            const active = state.activeCountry === countryId && ['cabinet', 'crisis', 'summit'].includes(state.phase)
            return (
              <g
                key={countryId}
                className={`web-node ${active ? 'active' : ''} ${country.signed ? 'signed' : ''} ${country.underPressure ? 'pressured' : ''}`}
                transform={`translate(${point.x} ${point.y})`}
                style={{ '--country': definition.color } as React.CSSProperties}
              >
                <circle r="48" className="node-halo" />
                <circle r="38" className="node-disc" />
                <text y="5" className="node-monogram">{definition.monogram}</text>
                <text y="63" className="node-name">{definition.name.toUpperCase()}</text>
                {country.signed ? (
                  <foreignObject x="20" y="-43" width="26" height="26"><span className="node-status signed-status"><Check size={15} aria-label="Signed" /></span></foreignObject>
                ) : (
                  <foreignObject x="20" y="-43" width="26" height="26"><span className="node-status"><LockKeyhole size={13} aria-label="Unsigned" /></span></foreignObject>
                )}
              </g>
            )
          })}
        </svg>
        <div className="signature-count"><strong>{signed}/{state.playerCount}</strong><span>signatures</span></div>
      </div>
    </section>
  )
}
