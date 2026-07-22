import { BookOpen, Clock3, Menu } from 'lucide-react'
import { useState } from 'react'
import { COUNTRY_DEFINITIONS } from '../game/data'
import type { CountryId, GameAction, GameState } from '../game/types'
import { ActionDock } from './ActionDock'
import { CountryDossier } from './CountryDossier'
import { CountryStrip } from './CountryStrip'
import { CrisisPanel } from './CrisisPanel'
import { EndingOverlay, PassCurtain, TableDrawer } from './Overlays'
import { SharedTracks } from './SharedTracks'
import { TreatyWeb } from './TreatyWeb'

type GameTableProps = {
  state: GameState
  lockedFor: CountryId | null
  onUnlock: () => void
  onAction: (action: GameAction) => void
  onNewGame: () => void
}

const PHASE_LABELS = {
  cabinet: 'Cabinet',
  crisis: 'Crisis council',
  summit: 'Peace summit',
} as const

export function GameTable({ state, lockedFor, onUnlock, onAction, onNewGame }: GameTableProps) {
  const [drawer, setDrawer] = useState<'rules' | 'minutes' | null>(null)
  const [endingReviewed, setEndingReviewed] = useState(false)
  const actionPhase = state.phase === 'cabinet' || state.phase === 'crisis' || state.phase === 'summit'
  const viewer = actionPhase ? state.activeCountry : state.humanCountry ?? state.firstPlayer
  const privateView = state.mode === 'hotseat' ? actionPhase : viewer === state.humanCountry

  const startNew = () => {
    if (state.ending || window.confirm('Leave this table and start a new game? The current saved game will be replaced.')) onNewGame()
  }

  return (
    <div className="game-app">
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
          <button type="button" onClick={startNew}><Menu /> <span>New table</span></button>
        </div>
      </header>

      <main className="table-surface">
        <SharedTracks state={state} />
        <div className="table-grid">
          <CrisisPanel state={state} />
          <TreatyWeb state={state} />
          <CountryDossier state={state} countryId={viewer} privateView={privateView} />
        </div>
        <CountryStrip state={state} />
        {state.phase !== 'ended' && <ActionDock state={state} onAction={onAction} />}
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
