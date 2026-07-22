import { describe, expect, it } from 'vitest'
import { chooseAiAction } from './ai'
import { COUNTRY_DEFINITIONS, CRISIS_CARDS } from './data'
import {
  averageTrust,
  getContributionTotals,
  getSigningStatus,
  isMandateMet,
  reduceGame,
  runInvariants,
  setupGame,
} from './engine'
import { COUNTRY_IDS, type CountryId, type GameState } from './types'

function allAiGame(playerCount: number, seed: number): GameState {
  const state = setupGame({ playerCount, seed, mode: 'hotseat', humanCountry: 'aravell' })
  for (const country of COUNTRY_IDS) state.controllers[country] = 'ai'
  return state
}

function autoPlay(playerCount: number, seed: number): GameState {
  let state = allAiGame(playerCount, seed)
  let guard = 0
  while (!state.ending && guard < 300) {
    guard += 1
    if (state.phase === 'briefing') state = reduceGame(state, { type: 'ACKNOWLEDGE_BRIEFING' })
    else if (state.phase === 'aftermath') state = reduceGame(state, { type: 'CONTINUE_ROUND' })
    else {
      const action = chooseAiAction(state)
      if (!action) throw new Error(`AI could not act during ${state.phase}`)
      state = reduceGame(state, action)
    }
    runInvariants(state)
  }
  expect(guard).toBeLessThan(300)
  return state
}

describe("On War's End v3 engine", () => {
  it('sets up deterministic one-country-per-player games for every supported count', () => {
    for (let playerCount = 2; playerCount <= 6; playerCount += 1) {
      const first = setupGame({ playerCount, seed: 8020, mode: 'solo', humanCountry: 'aravell' })
      const second = setupGame({ playerCount, seed: 8020, mode: 'solo', humanCountry: 'aravell' })
      expect(first).toEqual(second)
      expect(first.countryOrder).toEqual(COUNTRY_IDS.slice(0, playerCount))
      expect(first.refugeePool).toBe(2 * playerCount)
      expect(first.currentCrisisId).toBeTruthy()
      expect(first.countryOrder.every((country) => first.countries[country].policyHand.length === 3)).toBe(true)
    }
  })

  it('uses every country definition and all six non-repeating crises', () => {
    expect(Object.keys(COUNTRY_DEFINITIONS)).toEqual([...COUNTRY_IDS])
    expect(new Set(CRISIS_CARDS.map((crisis) => crisis.id)).size).toBe(6)
    expect(new Set(CRISIS_CARDS.map((crisis) => crisis.location)).size).toBe(6)
  })

  it('moves through the shortened cabinet with one policy per country', () => {
    let state = allAiGame(4, 17)
    state = reduceGame(state, { type: 'ACKNOWLEDGE_BRIEFING' })
    const actors = new Set<CountryId>()
    while (state.phase === 'cabinet') {
      actors.add(state.activeCountry)
      const action = chooseAiAction(state)
      if (!action) throw new Error('Expected a cabinet action.')
      state = reduceGame(state, action)
    }
    expect(actors).toEqual(new Set(COUNTRY_IDS.slice(0, 4)))
    expect(state.phase).toBe('crisis')
  })

  it('spends sealed crisis commitments and resolves only after every country commits', () => {
    let state = allAiGame(3, 31)
    state = reduceGame(state, { type: 'ACKNOWLEDGE_BRIEFING' })
    while (state.phase === 'cabinet') state = reduceGame(state, chooseAiAction(state)!)
    while (state.phase === 'crisis') state = reduceGame(state, chooseAiAction(state)!)
    expect(state.phase).toBe('summit')
    expect(Object.keys(state.commitments)).toHaveLength(3)
    expect(Object.values(getContributionTotals(state)).every((amount) => Number.isInteger(amount))).toBe(true)
    expect(state.lastCrisisResult).not.toBeNull()
  })

  it('turns a fair exchange into both resources and trust', () => {
    let state = setupGame({ playerCount: 2, seed: 4, mode: 'hotseat', humanCountry: 'aravell' })
    state.phase = 'summit'
    state.activeCountry = 'aravell'
    state.countries.aravell.resources.food = 2
    state.countries.tomerin.resources.fuel = 2
    const beforeTrust = averageTrust(state, 'aravell')
    state = reduceGame(state, { type: 'POST_OFFER', country: 'aravell', give: 'food', want: 'fuel' })
    state = reduceGame(state, { type: 'ACCEPT_OFFER', country: 'tomerin', offerCountry: 'aravell' })
    expect(state.countries.aravell.resources.fuel).toBe(2)
    expect(state.countries.tomerin.resources.food).toBe(2)
    expect(averageTrust(state, 'aravell')).toBe(beforeTrust + 1)
  })

  it('requires mandate, peace, trust, and a safe red line before signing', () => {
    const state = setupGame({ playerCount: 2, seed: 2, mode: 'hotseat', humanCountry: 'aravell' })
    expect(isMandateMet(state, 'aravell')).toBe(false)
    expect(getSigningStatus(state, 'aravell').reasons.length).toBeGreaterThanOrEqual(2)
    state.countries.aravell.resources.fuel = 3
    state.countries.aravell.resources.capital = 3
    state.peaceMomentum = 6
    state.trust['aravell:tomerin'] = 2
    expect(getSigningStatus(state, 'aravell')).toEqual({ eligible: true, reasons: [] })
  })

  it('autoplays every player count without illegal states across many seeds', () => {
    for (let playerCount = 2; playerCount <= 6; playerCount += 1) {
      const outcomes = new Set<string>()
      for (let seed = 1; seed <= 12; seed += 1) {
        const final = autoPlay(playerCount, seed * 97 + playerCount)
        expect(final.ending).not.toBeNull()
        outcomes.add(final.ending!.result)
      }
      expect(outcomes, `${playerCount}-country AI outcomes`).toEqual(new Set(['victory', 'defeat']))
    }
  })
})
