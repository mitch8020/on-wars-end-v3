import { ChevronRight, LockKeyhole } from 'lucide-react'
import type { CSSProperties } from 'react'
import { COUNTRY_DEFINITIONS } from '../../game/data'
import type { CountryId } from '../../game/types'

type PassCurtainProps = {
  country: CountryId
  onReady: () => void
}

export function PassCurtain({ country, onReady }: PassCurtainProps) {
  const definition = COUNTRY_DEFINITIONS[country]
  return (
    <div
      className="pass-curtain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pass-title"
      style={
        {
          '--country': definition.color,
          '--country-soft': definition.colorSoft,
        } as CSSProperties
      }
    >
      <div className="curtain-lines" aria-hidden="true" />
      <div className="pass-card">
        <LockKeyhole size={25} aria-hidden="true" />
        <p className="section-label">Private handoff</p>
        <h2 id="pass-title">
          Pass the table to
          <br />
          {definition.name}
        </h2>
        <p>
          Only the {definition.name} player should see the next screen. Their policy hand and national
          mandate are private.
        </p>
        <button type="button" className="button-primary" onClick={onReady}>
          I am {definition.name} <ChevronRight size={17} />
        </button>
      </div>
    </div>
  )
}
