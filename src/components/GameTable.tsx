import {
  BookOpen,
  Clock3,
  FastForward,
  Menu,
  Radio,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { COUNTRY_DEFINITIONS } from '../game/data'
import { isActionPhase, type CountryId, type GameAction, type GameState } from '../game/types'
import { useTableAudio } from '../presentation/useTableAudio'
import { ActionDock } from './ActionDock'
import { CountryDossier } from './CountryDossier'
import { CountryStrip } from './CountryStrip'
import { CrisisPanel } from './CrisisPanel'
import { EndingOverlay, PassCurtain, TableDrawer } from './Overlays'
import { SharedTracks } from './SharedTracks'
import { TableStage } from './tabletop/TableStage'

type GameTableProps = {
  state: GameState
  lockedFor: CountryId | null
  onUnlock: () => void
  onAction: (action: GameAction) => void
  onNewGame: () => void
  isBusy?: boolean
  presentationMessage?: string | null
  onSkipPresentation?: () => void
}

const PHASE_LABELS = {
  cabinet: 'Cabinet',
  crisis: 'Crisis council',
  summit: 'Peace summit',
} as const

export function GameTable({
  state,
  lockedFor,
  onUnlock,
  onAction,
  onNewGame,
  isBusy = false,
  presentationMessage = null,
  onSkipPresentation,
}: GameTableProps) {
  const [drawer, setDrawer] = useState<'rules' | 'minutes' | null>(null)
  const [folio, setFolio] = useState<'crisis' | 'seat' | null>(null)
  const [endingReviewed, setEndingReviewed] = useState(false)
  const actionPhase = isActionPhase(state.phase)
  const viewer = actionPhase ? state.activeCountry : state.humanCountry ?? state.firstPlayer
  const [selection, setSelection] = useState<{ country: CountryId; viewer: CountryId }>({
    country: viewer,
    viewer,
  })
  const selectedCountry = selection.viewer === viewer ? selection.country : viewer
  const { enabled: audioEnabled, toggle: toggleAudio } = useTableAudio(state)
  const privateView =
    state.mode === 'hotseat'
      ? actionPhase && selectedCountry === state.activeCountry
      : selectedCountry === state.humanCountry

  const startNew = () => {
    if (state.ending || window.confirm('Leave this table and start a new game? The current saved game will be replaced.')) onNewGame()
  }

  return (
    <div className={`game-app ${isBusy ? 'is-busy' : ''}`}>
      <header className="game-header">
        <div className="header-brand">
          <span className="brand-mark small"><span>III</span></span>
          <div><strong>On War’s End</strong><small>The Vellan Accord · Dispatch {state.seed}</small></div>
        </div>
        <div className="round-indicator"><span>Round</span><strong>{state.round}</strong><small>/ {state.maxRounds}</small></div>
        <nav className="phase-nav" aria-label="Round phases">
          {(Object.keys(PHASE_LABELS) as (keyof typeof PHASE_LABELS)[]).map((phase, index) => {
            const order = ['cabinet', 'crisis', 'summit']
            const currentIndex = order.indexOf(state.phase)
            const complete = state.phase === 'aftermath' || state.phase === 'ended' || index < currentIndex
            return <span key={phase} className={`${state.phase === phase ? 'active' : ''} ${complete ? 'complete' : ''}`}><i>{complete ? '✓' : index + 1}</i>{PHASE_LABELS[phase]}</span>
          })}
        </nav>
        <div className="header-actions">
          <button type="button" onClick={() => setDrawer('rules')}><BookOpen /> <span>Guide</span></button>
          <button type="button" onClick={() => setDrawer('minutes')}><Clock3 /> <span>Minutes</span></button>
          <button type="button" onClick={toggleAudio} aria-label={audioEnabled ? 'Mute table sounds' : 'Enable table sounds'}>
            {audioEnabled ? <Volume2 /> : <VolumeX />} <span>{audioEnabled ? 'Sound on' : 'Sound off'}</span>
          </button>
          <button type="button" onClick={startNew}><Menu /> <span>New table</span></button>
        </div>
      </header>

      <main className="table-surface">
        <SharedTracks state={state} />
        <div className="folio-tabs" aria-label="Table folios">
          <button type="button" onClick={() => setFolio('crisis')}>
            <Radio aria-hidden="true" /> Crisis dispatch
          </button>
          <button type="button" onClick={() => setFolio('seat')}>
            <UserRound aria-hidden="true" /> {COUNTRY_DEFINITIONS[selectedCountry].name} folio
          </button>
        </div>
        <div className="table-grid">
          <div className={`folio-panel crisis-folio ${folio === 'crisis' ? 'open' : ''}`}>
            <button type="button" className="folio-close" onClick={() => setFolio(null)} aria-label="Close crisis folio">
              <X />
            </button>
            <CrisisPanel state={state} />
          </div>
          <TableStage
            state={state}
            selectedCountry={selectedCountry}
            onSelectCountry={(country) => setSelection({ country, viewer })}
          />
          <div className={`folio-panel seat-folio ${folio === 'seat' ? 'open' : ''}`}>
            <button type="button" className="folio-close" onClick={() => setFolio(null)} aria-label="Close delegation folio">
              <X />
            </button>
            <CountryDossier state={state} countryId={selectedCountry} privateView={privateView} />
          </div>
        </div>
        {folio && <button type="button" className="folio-backdrop" onClick={() => setFolio(null)} aria-label="Close table folio" />}
        <CountryStrip state={state} />
        {state.phase !== 'ended' && (
          <div className="action-stage" aria-busy={isBusy}>
            {isBusy && presentationMessage ? (
              <div className="turn-choreography" role="status" aria-live="polite">
                <span className="turn-pulse" />
                <p>{presentationMessage}</p>
                {onSkipPresentation && (
                  <button type="button" onClick={onSkipPresentation}>
                    <FastForward aria-hidden="true" /> Skip envoy motion
                  </button>
                )}
              </div>
            ) : (
              <ActionDock state={state} onAction={onAction} />
            )}
          </div>
        )}
      </main>

      {actionPhase && (
        <div className="active-seat-ribbon" style={{ '--country': COUNTRY_DEFINITIONS[state.activeCountry].color } as React.CSSProperties}>
          <span>{COUNTRY_DEFINITIONS[state.activeCountry].monogram}</span>
          {COUNTRY_DEFINITIONS[state.activeCountry].name} has the floor
        </div>
      )}

      <TableDrawer key={drawer ?? 'closed'} state={state} open={drawer !== null} initialTab={drawer ?? 'rules'} onClose={() => setDrawer(null)} />
      {lockedFor && <PassCurtain country={lockedFor} onReady={onUnlock} />}
      {state.ending && !endingReviewed && <EndingOverlay state={state} onNewGame={onNewGame} onReview={() => setEndingReviewed(true)} />}
      {state.ending && endingReviewed && <button type="button" className="review-outcome-button" onClick={() => setEndingReviewed(false)}>Review outcome</button>}
    </div>
  )
}
