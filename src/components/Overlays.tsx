import { BookOpen, Check, ChevronRight, CircleOff, Clock3, FileText, LockKeyhole, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { COUNTRY_DEFINITIONS, RESOURCE_META } from '../game/data'
import type { CountryId, GameState, Resource } from '../game/types'

type DrawerProps = {
  state: GameState
  open: boolean
  initialTab: 'rules' | 'minutes'
  onClose: () => void
}

export function TableDrawer({ state, open, initialTab, onClose }: DrawerProps) {
  const [tab, setTab] = useState(initialTab)
  if (!open) return null
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="table-drawer" role="dialog" aria-modal="true" aria-label="Table reference">
        <header>
          <div className="drawer-tabs">
            <button type="button" className={tab === 'rules' ? 'selected' : ''} onClick={() => setTab('rules')}><BookOpen size={15} /> Field guide</button>
            <button type="button" className={tab === 'minutes' ? 'selected' : ''} onClick={() => setTab('minutes')}><Clock3 size={15} /> Minutes</button>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close drawer"><X /></button>
        </header>
        {tab === 'rules' ? <RulesContent /> : <MinutesContent state={state} />}
      </aside>
    </div>
  )
}

function RulesContent() {
  return (
    <div className="drawer-content rules-content">
      <p className="section-label">The Vellan Accord · Field guide</p>
      <h2>How peace is made</h2>
      <p className="rules-lede">Every player owns one country. You win together only when every country signs before Round 6 ends.</p>
      <ol className="round-sequence">
        <li><span>I</span><div><strong>Cabinet</strong><p>Choose one of three policies. Build resources, lower pressure, or cooperate directly.</p></div></li>
        <li><span>II</span><div><strong>Crisis council</strong><p>Commit what your country can spare. Contributions are spent even if the requirement is missed.</p></div></li>
        <li><span>III</span><div><strong>Peace summit</strong><p>Make one move: sign, exchange, build a backchannel, or pass.</p></div></li>
      </ol>
      <h3>Four locks on every signature</h3>
      <div className="rule-grid">
        <article><strong>Mandate</strong><p>Meet your country’s private political requirement.</p></article>
        <article><strong>Red line</strong><p>Restore any breached red line before signing.</p></article>
        <article><strong>Peace 6+</strong><p>Build enough shared momentum for a credible accord.</p></article>
        <article><strong>Trust 2+</strong><p>Your average relationship with the table must reach 2.</p></article>
      </div>
      <h3>Trust is a resource</h3>
      <p>Countries build Trust by carrying a fair share of crises, completing exchanges, using diplomatic policies, and opening backchannels. If one country contributes nothing while another carries the crisis, their relationship weakens.</p>
      <h3>Shared defeat</h3>
      <ul className="loss-list">
        <li>Global Unrest reaches 10.</li>
        <li>Refugees rise above 5 per country.</li>
        <li>Any country reaches 0 Population or 0 Military.</li>
        <li>Round 6 ends before every country signs.</li>
      </ul>
      <div className="resource-reference">
        <h3>Resources</h3>
        {(Object.keys(RESOURCE_META) as Resource[]).map((resource) => <span key={resource}><i className={`resource-dot resource-${resource}`} />{RESOURCE_META[resource].label}</span>)}
      </div>
    </div>
  )
}

function MinutesContent({ state }: { state: GameState }) {
  return (
    <div className="drawer-content minutes-content">
      <p className="section-label">Official record · Dispatch {state.seed}</p>
      <h2>Conference minutes</h2>
      <div className="minutes-list">
        {[...state.log].reverse().map((entry) => (
          <article key={entry.id}>
            <span>{String(entry.id + 1).padStart(2, '0')}</span>
            <div><small>Round {entry.round} · {entry.phase}{entry.country ? ` · ${COUNTRY_DEFINITIONS[entry.country].name}` : ''}</small><p>{entry.message}</p></div>
          </article>
        ))}
      </div>
    </div>
  )
}

export function PassCurtain({ country, onReady }: { country: CountryId; onReady: () => void }) {
  const definition = COUNTRY_DEFINITIONS[country]
  return (
    <div className="pass-curtain" role="dialog" aria-modal="true" aria-labelledby="pass-title" style={{ '--country': definition.color, '--country-soft': definition.colorSoft } as React.CSSProperties}>
      <div className="curtain-lines" aria-hidden="true" />
      <div className="pass-card">
        <LockKeyhole size={25} aria-hidden="true" />
        <p className="section-label">Private handoff</p>
        <h2 id="pass-title">Pass the table to<br />{definition.name}</h2>
        <p>Only the {definition.name} player should see the next screen. Their policy hand and national mandate are private.</p>
        <button type="button" className="button-primary" onClick={onReady}>I am {definition.name} <ChevronRight size={17} /></button>
      </div>
    </div>
  )
}

export function EndingOverlay({ state, onNewGame, onReview }: { state: GameState; onNewGame: () => void; onReview: () => void }) {
  const ending = state.ending
  if (!ending) return null
  const victory = ending.result === 'victory'
  return (
    <div className={`ending-overlay ${victory ? 'victory' : 'defeat'}`} role="dialog" aria-modal="true" aria-labelledby="ending-title">
      <div className="ending-communique">
        <div className="ending-stamp">{victory ? <Check /> : <CircleOff />}<span>{victory ? 'ACCORD' : 'NO TREATY'}</span></div>
        <p className="section-label">Final communiqué · Dispatch {state.seed}</p>
        <h2 id="ending-title">{ending.title}</h2>
        <p className="ending-reason">{ending.reason}</p>
        <blockquote>{ending.epilogue}</blockquote>
        <div className="ending-signatures">
          {state.countryOrder.map((country) => <span key={country} className={state.countries[country].signed ? 'signed' : ''}>{state.countries[country].signed ? <Check size={12} /> : <X size={12} />}{COUNTRY_DEFINITIONS[country].name}</span>)}
        </div>
        <div className="ending-actions">
          <button type="button" className="button-quiet" onClick={onReview}><FileText size={15} /> Review final table</button>
          <button type="button" className="button-primary" onClick={onNewGame}><RotateCcw size={15} /> Convene a new table</button>
        </div>
      </div>
    </div>
  )
}
