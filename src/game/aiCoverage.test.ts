import { describe, expect, it } from 'vitest'
import {
  chooseAiAction,
  describeAi,
  runAiUntilHumanOrPause,
} from './ai'
import { chooseAiPolicy } from './ai/cabinet'
import { chooseAiCommitment } from './ai/crisis'
import { reserveFor } from './ai/reserves'
import { strategicScore } from './ai/scoring'
import { chooseAiSummitAction } from './ai/summit'
import { trustKey } from './rules'
import { setupGame } from './setup'
import { COUNTRY_IDS, RESOURCES, type CountryId, type GameState } from './types'

function game(playerCount = 6): GameState {
  return setupGame({
    playerCount,
    seed: 148802,
    mode: 'hotseat',
    humanCountry: 'aravell',
  })
}

function summitState(country: CountryId, playerCount = 6): GameState {
  const state = game(playerCount)
  state.phase = 'summit'
  state.activeCountry = country
  state.firstPlayer = country
  state.summitTurnsTaken = {}
  for (const id of state.countryOrder) {
    state.controllers[id] = 'ai'
    if (id !== country) state.trust[trustKey(country, id)] = 1
  }
  return state
}

function makeEligible(state: GameState, country: CountryId): void {
  const current = state.countries[country]
  for (const resource of RESOURCES) current.resources[resource] = 10
  current.civilianPopulation = 10
  current.military = 10
  current.underPressure = false
  state.globalUnrest = 0
  state.peaceMomentum = 10
  state.refugeePool = 0
  for (const other of state.countryOrder) {
    if (other !== country) state.trust[trustKey(country, other)] = 4
  }
}

describe('AI orchestration', () => {
  it('routes each action phase and pauses outside action phases', () => {
    const cabinet = game(2)
    cabinet.phase = 'cabinet'
    cabinet.activeCountry = 'aravell'
    expect(chooseAiAction(cabinet)?.type).toMatch(/PLAY_POLICY|CONSERVE_RESOURCES/)

    const crisis = game(2)
    crisis.phase = 'crisis'
    crisis.activeCountry = 'aravell'
    expect(chooseAiAction(crisis)?.type).toBe('SUBMIT_COMMITMENT')

    const summit = summitState('aravell', 2)
    expect(chooseAiAction(summit)?.type).toMatch(
      /SIGN_TREATY|ACCEPT_OFFER|BUILD_TRUST|POST_OFFER|PASS_SUMMIT/,
    )

    const briefing = game(2)
    expect(chooseAiAction(briefing)).toBeNull()
    expect(runAiUntilHumanOrPause(briefing)).toBe(briefing)
  })

  it('runs consecutive AI turns until the next human or phase pause', () => {
    const state = game(2)
    state.phase = 'cabinet'
    state.activeCountry = 'tomerin'
    state.firstPlayer = 'aravell'
    state.controllers.aravell = 'human'
    state.controllers.tomerin = 'ai'
    state.countries.aravell.policyPlayed = 'conserve-resources'

    const result = runAiUntilHumanOrPause(state)
    expect(result.phase).toBe('crisis')
    expect(result.activeCountry).toBe('aravell')
    expect(describeAi(result, 'tomerin')).toContain('Trust average')
  })

  it('checks ending, non-action, crisis, and summit loop boundaries', () => {
    const ended = game(2)
    ended.ending = {
      result: 'defeat',
      title: 'Finished',
      reason: 'Test',
      epilogue: 'Test',
    }
    expect(runAiUntilHumanOrPause(ended)).toBe(ended)

    const briefing = game(2)
    briefing.controllers[briefing.activeCountry] = 'ai'
    expect(runAiUntilHumanOrPause(briefing)).toBe(briefing)

    const crisis = game(2)
    crisis.phase = 'crisis'
    crisis.controllers.aravell = 'ai'
    crisis.controllers.tomerin = 'human'
    crisis.activeCountry = 'aravell'
    crisis.firstPlayer = 'aravell'
    expect(runAiUntilHumanOrPause(crisis).activeCountry).toBe('tomerin')

    const summit = summitState('aravell', 2)
    summit.controllers.aravell = 'ai'
    summit.controllers.tomerin = 'human'
    expect(runAiUntilHumanOrPause(summit).activeCountry).toBe('tomerin')
  })
})

describe('AI cabinet and crisis choices', () => {
  it('scores legal policy candidates and ignores previews that violate invariants', () => {
    const state = game(2)
    state.phase = 'cabinet'
    state.activeCountry = 'aravell'
    state.countries.aravell.policyHand = [
      'emergency-harvest',
      'state-visit',
      'factory-conversion',
    ]
    expect(chooseAiPolicy(state)).toMatchObject({ country: 'aravell' })

    state.trust['aravell:tomerin'] = 0.5
    expect(chooseAiPolicy(state)).toEqual({
      type: 'CONSERVE_RESOURCES',
      country: 'aravell',
    })
  })

  it('splits resource and military needs across pending countries and preserves reserves', () => {
    const resourceState = game(3)
    resourceState.phase = 'crisis'
    resourceState.activeCountry = 'aravell'
    resourceState.currentCrisisId = 'broken-rail'
    resourceState.countries.aravell.resources.industry = 0
    const resourceAction = chooseAiCommitment(resourceState)
    expect(resourceAction.type).toBe('SUBMIT_COMMITMENT')
    if (resourceAction.type === 'SUBMIT_COMMITMENT') {
      expect(resourceAction.commitment.industry).toBe(0)
    }

    const fulfilled = game(2)
    fulfilled.phase = 'crisis'
    fulfilled.activeCountry = 'tomerin'
    fulfilled.currentCrisisId = 'winter-famine'
    fulfilled.commitments.aravell = { food: 3 }
    const fulfilledAction = chooseAiCommitment(fulfilled)
    expect(fulfilledAction).toEqual({
      type: 'SUBMIT_COMMITMENT',
      country: 'tomerin',
      commitment: {},
    })

    const militaryState = game(2)
    militaryState.phase = 'crisis'
    militaryState.activeCountry = 'tomerin'
    militaryState.currentCrisisId = 'guns-at-dawn'
    militaryState.commitments.aravell = {}
    militaryState.countries.tomerin.military = 3
    const militaryAction = chooseAiCommitment(militaryState)
    expect(militaryAction.type).toBe('SUBMIT_COMMITMENT')
    if (militaryAction.type === 'SUBMIT_COMMITMENT') {
      expect(militaryAction.commitment.military).toBe(2)
    }
  })
})

describe('AI summit choices and strategic scoring', () => {
  it('signs immediately when the active country is eligible', () => {
    const state = summitState('aravell', 2)
    makeEligible(state, 'aravell')
    expect(chooseAiSummitAction(state)).toEqual({
      type: 'SIGN_TREATY',
      country: 'aravell',
    })
  })

  it('accepts a valuable offer and skips a stale proposal', () => {
    const state = summitState('aravell', 2)
    state.countries.aravell.resources.capital = 1
    state.countries.aravell.resources.food = 3
    state.countries.aravell.resources.fuel = 0
    state.countries.tomerin.resources.fuel = 2
    state.summitOffers.tomerin = {
      country: 'tomerin',
      give: 'fuel',
      want: 'food',
    }
    expect(chooseAiSummitAction(state)).toEqual({
      type: 'ACCEPT_OFFER',
      country: 'aravell',
      offerCountry: 'tomerin',
    })

    state.countries.tomerin.resources.fuel = 0
    expect(chooseAiSummitAction(state).type).not.toBe('ACCEPT_OFFER')
  })

  it('opens a backchannel when trust or peace is low', () => {
    const state = summitState('aravell', 3)
    state.countries.aravell.resources.capital = 3
    state.peaceMomentum = 6
    const action = chooseAiSummitAction(state)
    expect(action.type).toBe('BUILD_TRUST')
    if (action.type === 'BUILD_TRUST') expect(action.target).not.toBe('aravell')

    for (const other of state.countryOrder) {
      if (other !== 'aravell') state.trust[trustKey('aravell', other)] = 4
    }
    state.peaceMomentum = 2
    expect(chooseAiSummitAction(state).type).toBe('BUILD_TRUST')
  })

  it('posts needed-resource offers for every mandate profile', () => {
    const giveByCountry: Record<CountryId, 'food' | 'industry'> = {
      aravell: 'food',
      tomerin: 'industry',
      veyra: 'food',
      karsk: 'food',
      belovar: 'food',
      namarra: 'industry',
    }
    for (const country of COUNTRY_IDS) {
      const state = summitState(country)
      for (const resource of RESOURCES) state.countries[country].resources[resource] = 0
      const give = giveByCountry[country]
      state.countries[country].resources[give] = 5
      const alternate = give === 'food' ? 'industry' : 'fuel'
      state.countries[country].resources[alternate] = 4
      const action = chooseAiSummitAction(state)
      expect(action.type, country).toBe('POST_OFFER')
      if (action.type === 'POST_OFFER') {
        expect(action.give).not.toBe(action.want)
      }
    }
  })

  it('passes when mandate resources are already stocked but signing is pressure-blocked', () => {
    for (const country of COUNTRY_IDS) {
      const state = summitState(country)
      makeEligible(state, country)
      state.countries[country].underPressure = true
      expect(chooseAiSummitAction(state), country).toEqual({
        type: 'PASS_SUMMIT',
        country,
      })
    }
  })

  it('scores all country mandates plus victory and defeat terminal values', () => {
    const state = game(6)
    const scores = COUNTRY_IDS.map((country) => strategicScore(state, country))
    expect(scores.every(Number.isFinite)).toBe(true)

    state.ending = {
      result: 'victory',
      title: 'Victory',
      reason: 'Test',
      epilogue: 'Test',
    }
    expect(strategicScore(state, 'aravell')).toBe(100_000)
    state.ending.result = 'defeat'
    expect(strategicScore(state, 'aravell')).toBe(-100_000)
  })

  it('uses country-specific reserves and the default for unspecified resources', () => {
    expect(reserveFor('aravell', 'fuel')).toBe(2)
    expect(reserveFor('tomerin', 'capital')).toBe(1)
    expect(COUNTRY_IDS.map((country) => reserveFor(country, 'military'))).toEqual([
      2, 2, 2, 5, 2, 2,
    ])
  })
})
