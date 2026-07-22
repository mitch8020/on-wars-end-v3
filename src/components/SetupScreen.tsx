import { Bot, Check, Dice5, Handshake, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { COUNTRY_DEFINITIONS } from '../game/data'
import { COUNTRY_IDS, type CountryId, type GameMode, type SetupOptions } from '../game/types'

type SetupScreenProps = {
  onStart: (options: SetupOptions) => void
  hasSavedGame: boolean
  onResume: () => void
}

function freshSeed(): number {
  return Math.floor(100000 + Math.random() * 900000)
}

export function SetupScreen({ onStart, hasSavedGame, onResume }: SetupScreenProps) {
  const [playerCount, setPlayerCount] = useState(4)
  const [mode, setMode] = useState<GameMode>('solo')
  const [humanCountry, setHumanCountry] = useState<CountryId>('aravell')
  const [seed, setSeed] = useState(freshSeed)
  const roster = useMemo(() => COUNTRY_IDS.slice(0, playerCount), [playerCount])

  const choosePlayerCount = (count: number) => {
    const nextRoster = COUNTRY_IDS.slice(0, count)
    setPlayerCount(count)
    if (!nextRoster.includes(humanCountry)) setHumanCountry(nextRoster[0])
  }

  return (
    <main className="setup-screen">
      <div className="setup-atmosphere" aria-hidden="true">
        <div className="map-line map-line-one" />
        <div className="map-line map-line-two" />
        <div className="map-line map-line-three" />
      </div>

      <header className="setup-brand">
        <div className="brand-mark" aria-hidden="true"><span>III</span></div>
        <div>
          <p className="eyebrow">A cooperative negotiation game</p>
          <h1>On War’s End</h1>
          <p className="setup-thesis">Peace is not the absence of pressure.<br />It is what survives it.</p>
        </div>
      </header>

      <section className="setup-console" aria-labelledby="convene-heading">
        <div className="setup-console-heading">
          <div>
            <p className="section-label">Scenario 01 · The Vellan Accord</p>
            <h2 id="convene-heading">Convene the peace table</h2>
          </div>
          <div className="scenario-time">2–6 countries · 6 rounds · 30–60 min</div>
        </div>

        <div className="setup-grid">
          <div className="setup-field">
            <span className="field-label">Countries at the table</span>
            <div className="segmented-control player-count-control" aria-label="Player count">
              {[2, 3, 4, 5, 6].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={playerCount === count ? 'selected' : ''}
                  onClick={() => choosePlayerCount(count)}
                  aria-pressed={playerCount === count}
                >
                  {count}
                </button>
              ))}
            </div>
            <p className="field-help">Every country has one owner, one mandate, and one red line.</p>
          </div>

          <div className="setup-field">
            <span className="field-label">Table mode</span>
            <div className="mode-cards">
              <button type="button" className={mode === 'solo' ? 'mode-card selected' : 'mode-card'} onClick={() => setMode('solo')}>
                <Bot aria-hidden="true" />
                <span><strong>Solo envoy</strong><small>Lead one country; AI envoys lead the rest.</small></span>
                {mode === 'solo' && <Check className="mode-check" aria-hidden="true" />}
              </button>
              <button type="button" className={mode === 'hotseat' ? 'mode-card selected' : 'mode-card'} onClick={() => setMode('hotseat')}>
                <UsersRound aria-hidden="true" />
                <span><strong>Pass & play</strong><small>One local player owns each country.</small></span>
                {mode === 'hotseat' && <Check className="mode-check" aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        <div className="roster-heading">
          <span className="field-label">{mode === 'solo' ? 'Choose your country' : 'Countries in play'}</span>
          <span>{roster.length} seats · clockwise order</span>
        </div>
        <div className="country-roster">
          {roster.map((countryId, index) => {
            const country = COUNTRY_DEFINITIONS[countryId]
            const selected = mode === 'solo' && humanCountry === countryId
            return (
              <button
                type="button"
                key={countryId}
                className={`roster-card ${selected ? 'selected' : ''}`}
                onClick={() => mode === 'solo' && setHumanCountry(countryId)}
                disabled={mode === 'hotseat'}
                style={{ '--country': country.color, '--country-soft': country.colorSoft } as React.CSSProperties}
              >
                <span className="roster-order">{String(index + 1).padStart(2, '0')}</span>
                <span className="country-sigil">{country.monogram}</span>
                <span className="roster-copy">
                  <strong>{country.name}</strong>
                  <small>{country.epithet}</small>
                </span>
                {selected && <Check className="roster-check" aria-label="Selected" />}
              </button>
            )
          })}
        </div>

        <div className="setup-footer">
          <label className="seed-field">
            <span>Dispatch code</span>
            <input value={seed} onChange={(event) => setSeed(Number(event.target.value.replace(/\D/g, '').slice(0, 9)) || 1)} inputMode="numeric" />
            <button type="button" onClick={() => setSeed(freshSeed())} aria-label="Roll a new dispatch code"><Dice5 aria-hidden="true" /></button>
          </label>
          <div className="setup-actions">
            {hasSavedGame && <button type="button" className="button-quiet" onClick={onResume}>Resume table</button>}
            <button
              type="button"
              className="button-primary button-convene"
              onClick={() => onStart({ playerCount, mode, humanCountry: roster.includes(humanCountry) ? humanCountry : roster[0], seed })}
            >
              <Handshake aria-hidden="true" /> Convene the table
            </button>
          </div>
        </div>
      </section>

      <aside className="setup-stakes" aria-label="How the game is won">
        <div><span className="stakes-number">06</span><p><strong>Rounds to make peace.</strong> Each round asks for one cabinet policy, one crisis commitment, and one summit move.</p></div>
        <div><span className="stakes-number">ALL</span><p><strong>Signatures required.</strong> Meet your mandate, protect your red line, earn Trust, and sign before time expires.</p></div>
      </aside>
    </main>
  )
}
