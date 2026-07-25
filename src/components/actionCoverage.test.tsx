// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { COUNTRY_DEFINITIONS } from '../game/data'
import type { GameAction } from '../game/types'
import {
  addCrisisResult,
  gameInPhase,
  makeCountryEligible,
} from '../test/fixtures'
import { ActionDock } from './ActionDock'
import { AftermathActions } from './actions/AftermathActions'
import { BriefingActions } from './actions/BriefingActions'
import { CabinetActions } from './actions/CabinetActions'
import { CrisisActions } from './actions/CrisisActions'
import { SummitActions } from './actions/SummitActions'

describe('briefing, aftermath, and action routing', () => {
  it('dispatches the briefing action', () => {
    const onAction = vi.fn()
    render(<BriefingActions state={gameInPhase('briefing', 2)} onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: /Open cabinet/ }))
    expect(onAction).toHaveBeenCalledWith({ type: 'ACKNOWLEDGE_BRIEFING' })
  })

  it('renders no aftermath without a result, then success and final failure actions', () => {
    const state = gameInPhase('aftermath', 2)
    const onAction = vi.fn()
    const { rerender } = render(<AftermathActions state={state} onAction={onAction} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    addCrisisResult(state, true)
    rerender(<AftermathActions state={state} onAction={onAction} />)
    expect(screen.getByText('The table holds')).toBeInTheDocument()
    expect(screen.getByText('4/4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Begin round 2/ }))
    expect(onAction).toHaveBeenCalledWith({ type: 'CONTINUE_ROUND' })

    addCrisisResult(state, false)
    state.round = state.maxRounds
    rerender(<AftermathActions state={state} onAction={onAction} />)
    expect(screen.getByText('The table fractures')).toBeInTheDocument()
    expect(screen.getByText('0/4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Read the final outcome/ })).toBeInTheDocument()
  })

  it('routes all five playable phases and renders no action for ended games', () => {
    const state = gameInPhase('briefing', 2)
    const onAction = vi.fn()
    const { rerender } = render(<ActionDock state={state} onAction={onAction} />)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()

    state.phase = 'cabinet'
    rerender(<ActionDock state={state} onAction={onAction} />)
    expect(screen.getByRole('heading', { name: 'Choose one national policy' })).toBeInTheDocument()
    state.phase = 'crisis'
    rerender(<ActionDock state={state} onAction={onAction} />)
    expect(screen.getByRole('heading', { name: 'Seal your commitment' })).toBeInTheDocument()
    state.phase = 'summit'
    rerender(<ActionDock state={state} onAction={onAction} />)
    expect(screen.getByRole('heading', { name: 'Make one diplomatic move' })).toBeInTheDocument()
    state.phase = 'aftermath'
    addCrisisResult(state, true)
    rerender(<ActionDock state={state} onAction={onAction} />)
    expect(screen.getByText('The table holds')).toBeInTheDocument()
    state.phase = 'ended'
    rerender(<ActionDock state={state} onAction={onAction} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})

describe('cabinet actions', () => {
  it('handles an empty hand and conservation', () => {
    const state = gameInPhase('cabinet', 2)
    state.countries[state.activeCountry].policyHand = []
    const onAction = vi.fn()
    render(<CabinetActions state={state} onAction={onAction} />)
    expect(screen.getByText('Choose a policy.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enact policy/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Conserve instead/ }))
    expect(onAction).toHaveBeenCalledWith({
      type: 'CONSERVE_RESOURCES',
      country: state.activeCountry,
    })
  })

  it('selects affordable and targeted policies before dispatching them', () => {
    const state = gameInPhase('cabinet', 3)
    const country = state.activeCountry
    state.countries[country].policyHand = [
      'factory-conversion',
      'state-visit',
      'emergency-harvest',
    ]
    state.countries[country].resources.capital = 0
    const onAction = vi.fn()
    const { rerender } = render(<CabinetActions state={state} onAction={onAction} />)
    expect(screen.getByText('Factory conversion').closest('button')).toHaveClass('unaffordable')
    const factory = screen.getByText('Factory conversion').closest('button')!
    const stateVisit = screen.getByText('State visit').closest('button')!
    fireEvent.keyDown(factory, { key: 'Enter' })
    fireEvent.keyDown(factory, { key: 'ArrowRight' })
    expect(stateVisit).toHaveFocus()
    fireEvent.keyDown(stateVisit, { key: 'ArrowLeft' })
    expect(factory).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /Emergency harvest/ }))
    fireEvent.click(screen.getByRole('button', { name: /Enact Emergency harvest/ }))
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'PLAY_POLICY',
      country,
      cardId: 'emergency-harvest',
      target: undefined,
    })

    state.countries[country].resources.capital = 3
    rerender(<CabinetActions state={state} onAction={onAction} />)
    fireEvent.click(screen.getByText('State visit').closest('button')!)
    expect(screen.getByText('Choose a partner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enact State visit/ })).toBeDisabled()
    const target = state.countryOrder.find((candidate) => candidate !== country)!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(target, 'i') }))
    fireEvent.click(screen.getByRole('button', { name: /Enact State visit/ }))
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'PLAY_POLICY',
      country,
      cardId: 'state-visit',
      target,
    })
  })
})

describe('crisis commitment actions', () => {
  it('steps resource commitments, suggests a fair share, and seals them', () => {
    const state = gameInPhase('crisis', 2)
    state.currentCrisisId = 'winter-famine'
    const country = state.activeCountry
    state.countries[country].resources.food = 2
    const onAction = vi.fn()
    render(<CrisisActions state={state} onAction={onAction} />)

    const less = screen.getByRole('button', { name: 'Commit less Food' })
    const more = screen.getByRole('button', { name: 'Commit more Food' })
    expect(less).toBeDisabled()
    fireEvent.click(more)
    expect(screen.getByText('1 unit')).toBeInTheDocument()
    fireEvent.click(more)
    expect(more).toBeDisabled()
    fireEvent.click(less)
    fireEvent.click(screen.getByRole('button', { name: /Suggest a fair share/ }))
    expect(screen.getByText('2 units')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Seal commitment/ }))
    expect(onAction).toHaveBeenCalledWith({
      type: 'SUBMIT_COMMITMENT',
      country,
      commitment: { food: 2 },
    })
  })

  it('keeps one military in reserve and shares remaining military need', () => {
    const state = gameInPhase('crisis', 2)
    state.currentCrisisId = 'guns-at-dawn'
    const country = state.activeCountry
    state.countries[country].military = 2
    const onAction = vi.fn()
    render(<CrisisActions state={state} onAction={onAction} />)

    const more = screen.getByRole('button', { name: 'Commit more Military' })
    fireEvent.click(more)
    expect(more).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Suggest a fair share/ }))
    fireEvent.click(screen.getByRole('button', { name: /Seal commitment/ }))
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'SUBMIT_COMMITMENT',
      country,
      commitment: { military: 1 },
    })
  })
})

describe('summit actions', () => {
  it('shows blocked and ready accord states, offers, acceptance, and signing', () => {
    const state = gameInPhase('summit', 2)
    const country = state.activeCountry
    const other = state.countryOrder.find((candidate) => candidate !== country)!
    state.summitOffers[country] = { country, give: 'food', want: 'fuel' }
    state.summitOffers[other] = { country: other, give: 'food', want: 'fuel' }
    state.countries[country].resources.fuel = 0
    const onAction = vi.fn()
    const { rerender } = render(<SummitActions state={state} onAction={onAction} />)

    expect(screen.getByText('Your delegation is not ready')).toBeInTheDocument()
    const accept = screen.getByRole('button', {
      name: new RegExp(COUNTRY_DEFINITIONS[other].name, 'i'),
    })
    expect(accept).toBeDisabled()
    state.countries[country].resources.fuel = 2
    rerender(<SummitActions state={state} onAction={onAction} />)
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(COUNTRY_DEFINITIONS[other].name, 'i'),
      }),
    )
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'ACCEPT_OFFER',
      country,
      offerCountry: other,
    })

    makeCountryEligible(state, country)
    rerender(<SummitActions state={state} onAction={onAction} />)
    expect(screen.getByText('Your delegation can sign')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Sign the Vellan Accord/ }))
    expect(onAction).toHaveBeenLastCalledWith({ type: 'SIGN_TREATY', country })
  })

  it('builds exchange and backchannel actions, including disabled choices and pass', () => {
    const state = gameInPhase('summit', 3)
    const country = state.activeCountry
    state.countries[country].resources.food = 2
    state.countries[country].resources.industry = 0
    state.countries[country].resources.capital = 0
    const onAction = vi.fn<(action: GameAction) => void>()
    const { rerender } = render(<SummitActions state={state} onAction={onAction} />)

    fireEvent.click(screen.getByRole('button', { name: /Exchange/ }))
    fireEvent.change(screen.getByLabelText('You request'), { target: { value: 'food' } })
    expect(screen.getByRole('button', { name: /Post proposal/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('You give'), { target: { value: 'industry' } })
    fireEvent.change(screen.getByLabelText('You request'), { target: { value: 'fuel' } })
    expect(screen.getByRole('button', { name: /Post proposal/ })).toBeDisabled()

    state.countries[country].resources.industry = 2
    rerender(<SummitActions state={state} onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: /Post proposal/ }))
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'POST_OFFER',
      country,
      give: 'industry',
      want: 'fuel',
    })

    fireEvent.click(screen.getByRole('button', { name: /Backchannel/ }))
    expect(screen.getByRole('button', { name: /Open backchannel/ })).toBeDisabled()
    const target = state.countryOrder.find((candidate) => candidate !== country)!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(target, 'i') }))
    state.countries[country].resources.capital = 2
    rerender(<SummitActions state={state} onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: /Open backchannel/ }))
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'BUILD_TRUST',
      country,
      target,
    })

    fireEvent.click(screen.getByRole('button', { name: /Pass this summit move/ }))
    expect(onAction).toHaveBeenLastCalledWith({ type: 'PASS_SUMMIT', country })
    fireEvent.click(screen.getByRole('button', { name: /Accord/ }))
    expect(screen.getByText(/delegation is not ready/)).toBeInTheDocument()
  })

  it('falls back to the active country when no backchannel target exists', () => {
    const state = gameInPhase('summit', 2)
    state.countryOrder = [state.activeCountry]
    state.playerCount = 1
    state.countries[state.activeCountry].resources.capital = 2
    render(<SummitActions state={state} onAction={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Backchannel/ }))
    expect(screen.getByRole('button', { name: /Open backchannel/ })).toBeDisabled()
  })
})
