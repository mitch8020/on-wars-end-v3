// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeCountryEligible, addEnding, testGame } from '../test/fixtures'
import { CountryDossier } from './CountryDossier'
import { CountryStrip } from './CountryStrip'
import { CrisisPanel } from './CrisisPanel'
import { ResourceMark } from './ResourceMark'
import { SharedTracks } from './SharedTracks'
import { TreatyWeb } from './TreatyWeb'
import { EndingOverlay } from './overlays/EndingOverlay'
import { PassCurtain } from './overlays/PassCurtain'
import { TableDrawer } from './overlays/TableDrawer'

describe('resource and shared track displays', () => {
  it('renders labeled, compact, valued, muted, and default resource marks', () => {
    const { rerender } = render(<ResourceMark resource="food" />)
    expect(screen.getByTitle('Food')).toHaveTextContent('Food')

    rerender(
      <ResourceMark
        resource="military"
        value={3}
        compact
        label="Brigades"
        tone="danger"
      />,
    )
    expect(screen.getByTitle('Brigades: 3')).toHaveClass('tone-danger')
    expect(screen.queryByText('Brigades')).not.toBeInTheDocument()

    rerender(<ResourceMark resource="population" value={8} tone="muted" />)
    expect(screen.getByTitle('Population: 8')).toHaveTextContent('Population')
  })

  it('renders low, threshold, danger, over-max, and below-zero tracks', () => {
    const state = testGame(2)
    state.peaceMomentum = 5
    state.globalUnrest = 7
    state.refugeePool = -2
    const { rerender } = render(<SharedTracks state={state} />)
    expect(screen.getByText('1 to unlock signatures')).toBeInTheDocument()
    expect(screen.getByText('10 ends the conference')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Refugees' }).firstElementChild).toHaveStyle({
      width: '0%',
    })

    state.peaceMomentum = 11
    state.globalUnrest = 8
    state.refugeePool = 20
    rerender(<SharedTracks state={state} />)
    expect(screen.getByText('Treaty threshold reached')).toBeInTheDocument()
    expect(screen.getByText('Collapse is close')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Peace momentum' }).firstElementChild).toHaveStyle({
      width: '100%',
    })
  })
})

describe('country and crisis panels', () => {
  it('shows classified, revealed, pressured, AI, ready, and signed dossier states', () => {
    const state = testGame(2)
    const { rerender } = render(
      <CountryDossier state={state} countryId="aravell" privateView={false} />,
    )
    expect(screen.getByText('Your seat')).toBeInTheDocument()
    expect(screen.getByText('Classified by this delegation')).toBeInTheDocument()
    expect(screen.getByText('Secure')).toBeInTheDocument()
    expect(screen.getByText('NOT READY')).toBeInTheDocument()

    state.controllers.aravell = 'ai'
    state.countries.aravell.mandateRevealed = true
    state.countries.aravell.underPressure = true
    rerender(<CountryDossier state={state} countryId="aravell" privateView={false} />)
    expect(screen.getByText('AI envoy')).toBeInTheDocument()
    expect(screen.getByText('Under pressure')).toBeInTheDocument()

    makeCountryEligible(state, 'aravell')
    rerender(<CountryDossier state={state} countryId="aravell" privateView />)
    expect(screen.getByText('READY')).toBeInTheDocument()

    state.countries.aravell.signed = true
    rerender(<CountryDossier state={state} countryId="aravell" privateView />)
    expect(screen.getAllByText('SIGNED').length).toBeGreaterThan(0)
  })

  it('summarizes active, hidden, revealed, signed, AI, player, and pressured countries', () => {
    const state = testGame(4)
    state.phase = 'cabinet'
    state.activeCountry = 'aravell'
    state.controllers.aravell = 'human'
    state.controllers.tomerin = 'ai'
    state.countries.aravell.underPressure = true
    state.countries.tomerin.signed = true
    state.countries.karsk.mandateRevealed = true
    makeCountryEligible(state, 'karsk')

    render(<CountryStrip state={state} />)
    expect(screen.getAllByText('classified').length).toBeGreaterThan(0)
    expect(screen.getByText('mandate met')).toBeInTheDocument()
    expect(screen.getByText('mandate open')).toBeInTheDocument()
    expect(screen.getAllByText(/AI envoy|Player/)).toHaveLength(4)
    expect(screen.getByText('Aravell').closest('article')).toHaveClass('active', 'pressured')
  })

  it('shows multi-resource crisis requirements with missing and committed totals', () => {
    const state = testGame(2)
    state.currentCrisisId = 'broken-rail'
    state.commitments.aravell = { industry: 1 }
    render(<CrisisPanel state={state} />)
    expect(screen.getByRole('heading', { name: 'The broken rail' })).toBeInTheDocument()
    expect(screen.getByLabelText(/1 of 2 Industry committed/)).toBeInTheDocument()
    expect(screen.getByLabelText(/0 of 1 Capital committed/)).toBeInTheDocument()
  })
})

describe('treaty web and overlays', () => {
  it('lays out two and many countries across low and high peace states', () => {
    const two = testGame(2)
    two.phase = 'cabinet'
    two.activeCountry = 'aravell'
    two.countries.aravell.signed = true
    two.countries.tomerin.underPressure = true
    two.peaceMomentum = 5
    const { rerender } = render(<TreatyWeb state={two} />)
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByLabelText('Signed')).toBeInTheDocument()
    expect(screen.getByLabelText('Unsigned')).toBeInTheDocument()
    expect(document.querySelector('.seal-progress')).not.toHaveAttribute('filter')

    const many = testGame(3)
    many.peaceMomentum = 6
    rerender(<TreatyWeb state={many} />)
    expect(screen.getByText('0/3')).toBeInTheDocument()
    expect(document.querySelector('.seal-progress')).toHaveAttribute('filter', 'url(#sealGlow)')
    expect(document.querySelectorAll('.trust-edge')).toHaveLength(3)
  })

  it('hands off the private seat', () => {
    const onReady = vi.fn()
    render(<PassCurtain country="aravell" onReady={onReady} />)
    fireEvent.click(screen.getByRole('button', { name: /I am Aravell/ }))
    expect(onReady).toHaveBeenCalledOnce()
  })

  it('renders no ending, then victory and defeat controls with signature states', () => {
    const state = testGame(2)
    const onNewGame = vi.fn()
    const onReview = vi.fn()
    const { rerender } = render(
      <EndingOverlay state={state} onNewGame={onNewGame} onReview={onReview} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    addEnding(state, 'victory')
    state.countries.aravell.signed = true
    rerender(<EndingOverlay state={state} onNewGame={onNewGame} onReview={onReview} />)
    expect(screen.getByText('ACCORD')).toBeInTheDocument()
    expect(screen.getByText('Aravell').closest('span')).toHaveClass('signed')
    fireEvent.click(screen.getByRole('button', { name: /Review final table/ }))
    fireEvent.click(screen.getByRole('button', { name: /Convene a new table/ }))
    expect(onReview).toHaveBeenCalledOnce()
    expect(onNewGame).toHaveBeenCalledOnce()

    addEnding(state, 'defeat')
    state.countries.aravell.signed = false
    rerender(<EndingOverlay state={state} onNewGame={onNewGame} onReview={onReview} />)
    expect(screen.getByText('NO TREATY')).toBeInTheDocument()
  })

  it('switches drawer tabs and closes by button or backdrop only', () => {
    const state = testGame(2)
    state.log.push({
      id: state.log.length,
      round: 1,
      phase: 'cabinet',
      country: 'aravell',
      message: 'A country-specific minute.',
    })
    const onClose = vi.fn()
    const { rerender } = render(
      <TableDrawer state={state} open={false} initialTab="rules" onClose={onClose} />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(<TableDrawer state={state} open initialTab="rules" onClose={onClose} />)
    expect(screen.getByRole('heading', { name: 'How peace is made' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Minutes/ }))
    expect(screen.getByRole('heading', { name: 'Conference minutes' })).toBeInTheDocument()
    expect(screen.getByText('A country-specific minute.')).toBeInTheDocument()
    expect(screen.getAllByText(/Aravell/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /Field guide/ }))
    expect(screen.getByRole('heading', { name: 'How peace is made' })).toBeInTheDocument()
    fireEvent.mouseDown(within(screen.getByRole('dialog')).getByText('How peace is made'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    rerender(
      <TableDrawer
        key="minutes"
        state={state}
        open
        initialTab="minutes"
        onClose={onClose}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Conference minutes' })).toBeInTheDocument()
  })
})
