import { RotateCcw } from 'lucide-react'
import { Component, lazy, Suspense, useState, type ErrorInfo, type ReactNode } from 'react'
import { COUNTRY_DEFINITIONS } from '../../game/data'
import type { CountryId, GameState } from '../../game/types'
import { supportsWebGL } from '../../presentation/webgl'
import { TreatyWeb } from '../TreatyWeb'

const ThreeTable = lazy(() => import('./ThreeTable'))

type TableStageProps = {
  state: GameState
  selectedCountry: CountryId
  onSelectCountry: (countryId: CountryId) => void
}

type BoundaryProps = {
  fallback: ReactNode
  children: ReactNode
}

type BoundaryState = {
  failed: boolean
}

export class TableSceneBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('The physical table could not be rendered. Falling back to the table map.', error, info)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function TableFallback({ state }: { state: GameState }) {
  return (
    <div className="table-fallback" data-testid="table-fallback">
      <TreatyWeb state={state} />
      <p>Three-dimensional table unavailable. Every move remains playable from the controls below.</p>
    </div>
  )
}

export function TableStage({ state, selectedCountry, onSelectCountry }: TableStageProps) {
  const [cameraNonce, setCameraNonce] = useState(0)
  const webgl = supportsWebGL()
  const fallback = <TableFallback state={state} />
  const selected = COUNTRY_DEFINITIONS[selectedCountry]

  return (
    <section className="table-stage" aria-labelledby="physical-table-title">
      <div className="table-stage-heading">
        <div>
          <p className="section-label">The Vellan peace table</p>
          <h2 id="physical-table-title">Trust is built in public</h2>
        </div>
        {webgl && (
          <button
            type="button"
            className="camera-reset"
            onClick={() => setCameraNonce((value) => value + 1)}
          >
            <RotateCcw aria-hidden="true" /> Reset view
          </button>
        )}
      </div>
      <div className="table-stage-viewport">
        {webgl ? (
          <TableSceneBoundary fallback={fallback}>
            <Suspense
              fallback={
                <div className="table-loading" role="status">
                  <span />
                  Unfolding the conference cloth…
                </div>
              }
            >
              <ThreeTable
                state={state}
                cameraNonce={cameraNonce}
                onSelectCountry={onSelectCountry}
              />
            </Suspense>
          </TableSceneBoundary>
        ) : (
          fallback
        )}
        <div className="table-selection" aria-live="polite">
          <span style={{ '--country': selected.color } as React.CSSProperties}>
            {selected.monogram}
          </span>
          <div>
            <small>Viewing delegation</small>
            <strong>{selected.name}</strong>
          </div>
        </div>
      </div>
      <div className="sr-only">
        {state.countryOrder.map((countryId) => {
          const country = state.countries[countryId]
          return (
            <button key={countryId} type="button" onClick={() => onSelectCountry(countryId)}>
              View {COUNTRY_DEFINITIONS[countryId].name}, {country.signed ? 'signed' : 'unsigned'}
              {country.underPressure ? ', under pressure' : ''}
            </button>
          )
        })}
      </div>
    </section>
  )
}
