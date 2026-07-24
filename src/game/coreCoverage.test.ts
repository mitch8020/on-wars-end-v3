import { describe, expect, it } from 'vitest'
import { getCrisis, getPolicy, POLICY_CARDS } from './data'
import { runInvariants } from './invariants'
import { resourceLabel } from './labels'
import { nextRandom, shuffle } from './random'
import {
  averageTrust,
  canPlayPolicy,
  getContributionTotals,
  getSigningStatus,
  getTrust,
  isMandateMet,
  isRedLineSafe,
  trustKey,
} from './rules'
import { setupGame } from './setup'
import {
  appendLog,
  applyPolicy,
  changeTrust,
  clamp,
  cloneGameState,
  gainResources,
  spendResources,
} from './state'
import { continueRound } from './transitions/aftermath'
import { acknowledgeBriefing } from './transitions/briefing'
import { conserveResources, playPolicy } from './transitions/cabinet'
import { submitCommitment } from './transitions/crisis'
import { finalizeTransition, nextPendingCountry } from './transitions/lifecycle'
import { acceptOffer, buildTrust, passSummit, postOffer, signTreaty } from './transitions/summit'
import {
  COUNTRY_IDS,
  emptyBag,
  isActionPhase,
  RESOURCES,
  type CountryId,
  type GamePhase,
  type GameState,
  type PolicyCard,
} from './types'
import { reduceGame } from './reducer'

function game(playerCount = 6, seed = 148802): GameState {
  return setupGame({ playerCount, seed, mode: 'hotseat', humanCountry: 'aravell' })
}

function summitGame(playerCount = 2): GameState {
  const state = game(playerCount)
  state.phase = 'summit'
  state.activeCountry = state.firstPlayer
  state.summitTurnsTaken = {}
  return state
}

function makeEligible(state: GameState, country: CountryId): void {
  const current = state.countries[country]
  current.resources.food = 10
  current.resources.industry = 10
  current.resources.fuel = 10
  current.resources.capital = 10
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

function expectInvariantError(
  mutate: (state: GameState) => void,
  message: string,
): void {
  const state = game(3)
  mutate(state)
  expect(() => runInvariants(state)).toThrow(message)
}

function resolveCrisis(
  crisisId: string,
  commitments: Partial<Record<CountryId, Record<string, number>>>,
): GameState {
  let state = game(2)
  state.phase = 'crisis'
  state.activeCountry = state.firstPlayer
  state.currentCrisisId = crisisId
  state.commitments = {}
  for (const country of state.countryOrder) {
    for (const resource of RESOURCES) state.countries[country].resources[resource] = 20
    state.countries[country].military = 20
  }
  while (state.phase === 'crisis') {
    const country = state.activeCountry
    state = submitCommitment(state, {
      type: 'SUBMIT_COMMITMENT',
      country,
      commitment: commitments[country] ?? {},
    })
  }
  return state
}

describe('game primitives and setup boundaries', () => {
  it('normalizes setup inputs and creates isolated deterministic state', () => {
    const low = setupGame({
      playerCount: 1.2,
      seed: 0,
      mode: 'solo',
      humanCountry: 'namarra',
    })
    const high = setupGame({
      playerCount: 99,
      seed: -8.6,
      mode: 'hotseat',
      humanCountry: 'namarra',
    })

    expect(low.playerCount).toBe(2)
    expect(low.seed).toBe(1)
    expect(low.humanCountry).toBe('aravell')
    expect(low.firstPlayer).toBe('aravell')
    expect(high.playerCount).toBe(6)
    expect(high.seed).toBe(9)
    expect(high.humanCountry).toBeNull()
    expect(Object.values(high.controllers).every((controller) => controller === 'human')).toBe(true)

    const clone = cloneGameState(high)
    clone.countries.aravell.resources.food += 1
    expect(clone).not.toEqual(high)
  })

  it('covers random fallback, stable shuffles, action phases, bags, and labels', () => {
    const [random, fallback] = nextRandom(0)
    expect(random).toBeGreaterThan(0)
    expect(fallback).not.toBe(0)
    expect(shuffle([], 42)).toEqual([[], 42])
    expect(shuffle(['only'], 42)).toEqual([['only'], 42])
    expect(shuffle([1, 2, 3], 42)[0].sort()).toEqual([1, 2, 3])

    const phases: GamePhase[] = ['briefing', 'cabinet', 'crisis', 'summit', 'aftermath', 'ended']
    expect(phases.map(isActionPhase)).toEqual([false, true, true, true, false, false])
    expect(emptyBag()).toEqual({ food: 0, industry: 0, fuel: 0, capital: 0 })
    expect(resourceLabel('military')).toBe('Military')
    expect(resourceLabel('population')).toBe('Population')
    expect(resourceLabel('food')).toBe('Food')
  })

  it('looks up every card and rejects unknown catalog identifiers', () => {
    for (const policy of POLICY_CARDS) expect(getPolicy(policy.id)).toBe(policy)
    expect(getCrisis('winter-famine').title).toBe('The winter famine')
    expect(() => getPolicy('missing')).toThrow('Unknown policy card: missing')
    expect(() => getCrisis('missing')).toThrow('Unknown crisis card: missing')
  })
})

describe('rules and state helpers', () => {
  it('calculates trust in both key orders, including self and missing edges', () => {
    const state = game(2)
    expect(trustKey('tomerin', 'aravell')).toBe('aravell:tomerin')
    expect(trustKey('aravell', 'tomerin')).toBe('aravell:tomerin')
    expect(getTrust(state, 'aravell', 'aravell')).toBe(4)
    delete state.trust['aravell:tomerin']
    expect(getTrust(state, 'aravell', 'tomerin')).toBe(0)
    state.countryOrder = ['aravell']
    expect(averageTrust(state, 'aravell')).toBe(4)
  })

  it('checks every national red line and mandate on both sides of its boundary', () => {
    const state = game(6)
    makeEligible(state, 'aravell')
    for (const country of COUNTRY_IDS) {
      makeEligible(state, country)
      expect(isRedLineSafe(state, country)).toBe(true)
      expect(isMandateMet(state, country)).toBe(true)
    }

    state.countries.aravell.resources.fuel = 0
    state.globalUnrest = 7
    state.countries.veyra.resources.capital = 0
    state.countries.karsk.military = 2
    state.countries.belovar.civilianPopulation = 3
    state.refugeePool = 25
    for (const country of COUNTRY_IDS) expect(isRedLineSafe(state, country)).toBe(false)

    state.countries.aravell.resources.capital = 2
    state.countries.tomerin.resources.food = 2
    state.countries.veyra.resources.industry = 2
    state.countries.karsk.resources.capital = 2
    state.countries.belovar.resources.capital = 5
    state.countries.namarra.civilianPopulation = 9
    for (const country of COUNTRY_IDS) expect(isMandateMet(state, country)).toBe(false)
  })

  it('reports all signing blockers and the already-signed state', () => {
    const state = game(2)
    state.countries.aravell.signed = true
    expect(getSigningStatus(state, 'aravell')).toEqual({
      eligible: false,
      reasons: ['Treaty already signed'],
    })

    state.countries.aravell.signed = false
    state.countries.aravell.underPressure = true
    state.peaceMomentum = 5
    state.trust['aravell:tomerin'] = 1
    const blocked = getSigningStatus(state, 'aravell')
    expect(blocked.eligible).toBe(false)
    expect(blocked.reasons).toEqual([
      'National mandate is not met',
      'A national red line is under pressure',
      'Peace needs 1 more momentum',
      'Average Trust is 1.0; it must reach 2.0',
    ])

    makeEligible(state, 'aravell')
    expect(getSigningStatus(state, 'aravell')).toEqual({ eligible: true, reasons: [] })
  })

  it('rejects every illegal policy boundary and accepts a legal targeted policy', () => {
    const state = game(2)
    state.phase = 'cabinet'
    state.activeCountry = 'aravell'
    state.countries.aravell.policyHand = [
      'factory-conversion',
      'state-visit',
      'mutual-stand-down',
      'relief-corridor',
    ]

    state.phase = 'briefing'
    expect(canPlayPolicy(state, 'aravell', 'factory-conversion')).toBe('Cabinet is not in session.')
    state.phase = 'cabinet'
    state.activeCountry = 'tomerin'
    expect(canPlayPolicy(state, 'aravell', 'factory-conversion')).toContain('another country')
    state.activeCountry = 'aravell'
    expect(canPlayPolicy(state, 'aravell', 'missing')).toBe('That policy is not in this cabinet hand.')

    state.countries.aravell.resources.capital = 0
    expect(canPlayPolicy(state, 'aravell', 'factory-conversion')).toBe('The policy cost cannot be paid.')
    state.countries.aravell.resources.capital = 3
    expect(canPlayPolicy(state, 'aravell', 'state-visit')).toBe('Choose another country.')
    expect(canPlayPolicy(state, 'aravell', 'state-visit', 'aravell')).toBe('Choose another country.')
    expect(canPlayPolicy(state, 'aravell', 'state-visit', 'namarra')).toBe('Choose another country.')

    state.countries.aravell.military = 1
    state.countries.aravell.policyHand.push('demobilize-brigade')
    expect(canPlayPolicy(state, 'aravell', 'demobilize-brigade')).toContain('without a military')
    state.countries.aravell.military = 3
    state.countries.tomerin.military = 1
    expect(canPlayPolicy(state, 'aravell', 'mutual-stand-down', 'tomerin')).toContain(
      'partner without a military',
    )
    state.countries.tomerin.military = 3
    expect(canPlayPolicy(state, 'aravell', 'mutual-stand-down', 'tomerin')).toBe(true)
    expect(canPlayPolicy(state, 'aravell', 'demobilize-brigade')).toBe(true)

    state.refugeePool = 0
    state.countries.aravell.resources.food = 3
    expect(canPlayPolicy(state, 'aravell', 'relief-corridor')).toContain('no refugees')
    expect(canPlayPolicy(state, 'aravell', 'state-visit', 'tomerin')).toBe(true)
  })

  it('handles clamping, logs, resource changes, trust changes, and policy effects', () => {
    const state = game(2)
    expect(clamp(-2)).toBe(0)
    expect(clamp(20)).toBe(10)
    expect(clamp(4, 3, 5)).toBe(4)

    const logLength = state.log.length
    appendLog(state, 'A private note.', 'aravell')
    expect(state.log).toHaveLength(logLength + 1)
    expect(state.log.at(-1)?.country).toBe('aravell')

    const current = state.countries.aravell
    const food = current.resources.food
    spendResources(current, { food: 2 })
    gainResources(current, { food: 1 })
    expect(current.resources.food).toBe(food - 1)

    changeTrust(state, 'aravell', 'aravell', 4)
    delete state.trust['aravell:tomerin']
    changeTrust(state, 'tomerin', 'aravell', 10)
    expect(state.trust['aravell:tomerin']).toBe(4)
    changeTrust(state, 'aravell', 'tomerin', -20)
    expect(state.trust['aravell:tomerin']).toBe(0)

    const synthetic: PolicyCard = {
      id: 'synthetic',
      title: 'Synthetic coverage',
      kicker: 'Test',
      description: 'Exercises every optional effect.',
      cost: { food: 1 },
      gain: { industry: 1 },
      civilianDelta: 1,
      militaryDelta: 1,
      unrestDelta: 1,
      peaceDelta: 1,
      refugeeDelta: 1,
      targetCivilianDelta: 1,
      targetMilitaryDelta: 1,
      trustDelta: 1,
      revealMandate: true,
    }
    const partnerBefore = state.countries.tomerin.civilianPopulation
    applyPolicy(state, 'aravell', synthetic, 'tomerin')
    expect(state.countries.tomerin.civilianPopulation).toBe(partnerBefore + 1)
    expect(state.countries.tomerin.mandateRevealed).toBe(true)

    applyPolicy(
      state,
      'aravell',
      {
        id: 'target-without-trust',
        title: 'Target without trust',
        kicker: 'Test',
        description: 'Exercises absent optional target effects.',
      },
      'tomerin',
    )

    state.refugeePool = 1
    current.resources.food = 2
    current.resources.capital = 2
    const civilianBefore = current.civilianPopulation
    applyPolicy(state, 'aravell', getPolicy('relief-corridor'))
    expect(state.refugeePool).toBe(0)
    expect(current.civilianPopulation).toBe(civilianBefore + 1)
  })

  it('totals sparse commitments', () => {
    const state = game(3)
    state.commitments = {
      aravell: { food: 2 },
      tomerin: undefined,
      veyra: { food: 1, military: 2 },
    }
    expect(getContributionTotals(state)).toEqual({ food: 3, military: 2 })
  })
})

describe('invariant failures', () => {
  it('rejects structural and track corruption', () => {
    expectInvariantError((state) => {
      state.version = 'broken' as GameState['version']
    }, 'Unsupported game-state version.')
    expectInvariantError((state) => {
      state.playerCount = 2
    }, 'Player count and country order disagree.')
    expectInvariantError((state) => {
      state.countryOrder[1] = state.countryOrder[0]
    }, 'A country appears twice')
    expectInvariantError((state) => {
      state.activeCountry = 'namarra'
    }, 'active country')
    expectInvariantError((state) => {
      state.firstPlayer = 'namarra'
    }, 'first player')
    expectInvariantError((state) => {
      state.globalUnrest = -1
    }, 'Global Unrest')
    expectInvariantError((state) => {
      state.globalUnrest = 11
    }, 'Global Unrest')
    expectInvariantError((state) => {
      state.peaceMomentum = -1
    }, 'Peace Momentum')
    expectInvariantError((state) => {
      state.peaceMomentum = 11
    }, 'Peace Momentum')
    expectInvariantError((state) => {
      state.refugeePool = -1
    }, 'Refugee Pool')
  })

  it('rejects resource, population, trust, and ending corruption', () => {
    expectInvariantError((state) => {
      state.countries.aravell.resources.food = 0.5
    }, 'invalid food')
    expectInvariantError((state) => {
      state.countries.aravell.resources.food = -1
    }, 'invalid food')
    expectInvariantError((state) => {
      state.countries.aravell.civilianPopulation = 0.5
    }, 'fractional population')
    expectInvariantError((state) => {
      state.countries.aravell.military = 0.5
    }, 'fractional population')
    expectInvariantError((state) => {
      state.trust['aravell:tomerin'] = 0.5
    }, 'Trust edge')
    expectInvariantError((state) => {
      state.trust['aravell:tomerin'] = -1
    }, 'Trust edge')
    expectInvariantError((state) => {
      state.trust['aravell:tomerin'] = 5
    }, 'Trust edge')
    expectInvariantError((state) => {
      state.phase = 'ended'
    }, 'ending record disagree')
    expectInvariantError((state) => {
      state.ending = {
        result: 'defeat',
        title: 'Bad state',
        reason: 'Test',
        epilogue: 'Test',
      }
    }, 'ending record disagree')
  })
})

describe('phase transitions and endings', () => {
  it('rejects invalid briefing, cabinet, aftermath, and ended transitions', () => {
    const state = game(2)
    state.phase = 'cabinet'
    expect(() => acknowledgeBriefing(state)).toThrow('no briefing')
    state.activeCountry = 'tomerin'
    expect(() =>
      conserveResources(state, { type: 'CONSERVE_RESOURCES', country: 'aravell' }),
    ).toThrow('another country')
    state.phase = 'briefing'
    state.activeCountry = 'aravell'
    state.countries.aravell.policyHand = ['factory-conversion']
    expect(() =>
      playPolicy(state, {
        type: 'PLAY_POLICY',
        country: 'aravell',
        cardId: 'factory-conversion',
      }),
    ).toThrow('Cabinet is not in session')
    expect(() => continueRound(state)).toThrow('not ready to close')

    state.ending = {
      result: 'defeat',
      title: 'Finished',
      reason: 'Test',
      epilogue: 'Test',
    }
    expect(() => reduceGame(state, { type: 'ACKNOWLEDGE_BRIEFING' })).toThrow('already ended')
  })

  it('advances cabinet turns through both a policy and conservation', () => {
    let state = game(2)
    state = acknowledgeBriefing(state)
    const first = state.activeCountry
    state.countries[first].policyHand = ['emergency-harvest']
    state = playPolicy(state, {
      type: 'PLAY_POLICY',
      country: first,
      cardId: 'emergency-harvest',
    })
    expect(state.phase).toBe('cabinet')
    const second = state.activeCountry
    state = conserveResources(state, { type: 'CONSERVE_RESOURCES', country: second })
    expect(state.phase).toBe('crisis')
  })

  it('validates commitment input before spending it', () => {
    const state = game(2)
    state.phase = 'crisis'
    state.activeCountry = 'aravell'
    state.currentCrisisId = 'guns-at-dawn'

    state.phase = 'cabinet'
    expect(() =>
      submitCommitment(state, {
        type: 'SUBMIT_COMMITMENT',
        country: 'aravell',
        commitment: {},
      }),
    ).toThrow('not accepting')
    state.phase = 'crisis'
    expect(() =>
      submitCommitment(state, {
        type: 'SUBMIT_COMMITMENT',
        country: 'tomerin',
        commitment: {},
      }),
    ).toThrow('another country')
    state.commitments.aravell = {}
    expect(() =>
      submitCommitment(state, {
        type: 'SUBMIT_COMMITMENT',
        country: 'aravell',
        commitment: {},
      }),
    ).toThrow('already committed')
    state.commitments = {}
    expect(() =>
      submitCommitment(state, {
        type: 'SUBMIT_COMMITMENT',
        country: 'aravell',
        commitment: { food: 1 },
      }),
    ).toThrow('not requested')
    expect(() =>
      submitCommitment(state, {
        type: 'SUBMIT_COMMITMENT',
        country: 'aravell',
        commitment: { military: -1 },
      }),
    ).toThrow('whole, non-negative')
    expect(() =>
      submitCommitment(state, {
        type: 'SUBMIT_COMMITMENT',
        country: 'aravell',
        commitment: { military: 0.5 },
      }),
    ).toThrow('whole, non-negative')
    expect(() =>
      submitCommitment(state, {
        type: 'SUBMIT_COMMITMENT',
        country: 'aravell',
        commitment: { military: 99 },
      }),
    ).toThrow('Not enough military')
    state.countries.aravell.military = 1
    expect(() =>
      submitCommitment(state, {
        type: 'SUBMIT_COMMITMENT',
        country: 'aravell',
        commitment: { military: 1 },
      }),
    ).toThrow('cannot eliminate')
  })

  it('resolves successful, failed, shared, and asymmetric crisis commitments', () => {
    const shared = resolveCrisis('winter-famine', {
      aravell: { food: 2 },
      tomerin: { food: 2 },
    })
    expect(shared.lastCrisisResult?.succeeded).toBe(true)
    expect(shared.trust['aravell:tomerin']).toBeGreaterThan(1)

    const asymmetric = resolveCrisis('winter-famine', {
      aravell: { food: 1 },
      tomerin: {},
    })
    expect(asymmetric.lastCrisisResult?.succeeded).toBe(false)
    expect(asymmetric.trust['aravell:tomerin']).toBe(0)

    const civilianLoss = resolveCrisis('camp-fever', { aravell: {}, tomerin: {} })
    expect(civilianLoss.lastCrisisResult?.succeeded).toBe(false)
    const militaryLoss = resolveCrisis('guns-at-dawn', { aravell: {}, tomerin: {} })
    expect(militaryLoss.lastCrisisResult?.succeeded).toBe(false)
    const noOptionalLoss = resolveCrisis('currency-panic', { aravell: {}, tomerin: {} })
    expect(noOptionalLoss.lastCrisisResult?.succeeded).toBe(false)
  })

  it('rejects illegal summit actions and executes every diplomatic move', () => {
    let state = summitGame()
    state.phase = 'cabinet'
    expect(() =>
      postOffer(state, {
        type: 'POST_OFFER',
        country: state.activeCountry,
        give: 'food',
        want: 'fuel',
      }),
    ).toThrow('another country')

    state = summitGame()
    const first = state.activeCountry
    expect(() =>
      postOffer(state, { type: 'POST_OFFER', country: first, give: 'food', want: 'food' }),
    ).toThrow('different resources')
    state.countries[first].resources.food = 0
    expect(() =>
      postOffer(state, { type: 'POST_OFFER', country: first, give: 'food', want: 'fuel' }),
    ).toThrow('available to offer')
    state.countries[first].resources.food = 2
    state = postOffer(state, {
      type: 'POST_OFFER',
      country: first,
      give: 'food',
      want: 'fuel',
    })

    const second = state.activeCountry
    expect(() =>
      acceptOffer(state, { type: 'ACCEPT_OFFER', country: second, offerCountry: second }),
    ).toThrow('not available')
    state.summitOffers[second] = { country: second, give: 'food', want: 'fuel' }
    expect(() =>
      acceptOffer(state, { type: 'ACCEPT_OFFER', country: second, offerCountry: second }),
    ).toThrow('not available')
    delete state.summitOffers[second]
    state.countries[first].resources.food = 0
    expect(() =>
      acceptOffer(state, { type: 'ACCEPT_OFFER', country: second, offerCountry: first }),
    ).toThrow('no longer honor')
    state.countries[first].resources.food = 2
    state.countries[second].resources.fuel = 0
    expect(() =>
      acceptOffer(state, { type: 'ACCEPT_OFFER', country: second, offerCountry: first }),
    ).toThrow('need 1 fuel')
    state.countries[second].resources.fuel = 2
    state = acceptOffer(state, {
      type: 'ACCEPT_OFFER',
      country: second,
      offerCountry: first,
    })
    expect(state.phase).toBe('aftermath')

    state = summitGame()
    expect(() =>
      buildTrust(state, {
        type: 'BUILD_TRUST',
        country: state.activeCountry,
        target: state.activeCountry,
      }),
    ).toThrow('Choose another')
    expect(() =>
      buildTrust(state, {
        type: 'BUILD_TRUST',
        country: state.activeCountry,
        target: 'namarra',
      }),
    ).toThrow('Choose another')
    state.countries[state.activeCountry].resources.capital = 0
    expect(() =>
      buildTrust(state, {
        type: 'BUILD_TRUST',
        country: state.activeCountry,
        target: state.countryOrder[1],
      }),
    ).toThrow('costs 1 Capital')
    state.countries[state.activeCountry].resources.capital = 2
    state = buildTrust(state, {
      type: 'BUILD_TRUST',
      country: state.activeCountry,
      target: state.countryOrder[1],
    })
    expect(state.summitTurnsTaken[state.firstPlayer]).toBe(true)
  })

  it('blocks, advances, and completes treaty signing', () => {
    let state = summitGame()
    expect(() =>
      signTreaty(state, { type: 'SIGN_TREATY', country: state.activeCountry }),
    ).toThrow('mandate')

    makeEligible(state, state.activeCountry)
    state = signTreaty(state, { type: 'SIGN_TREATY', country: state.activeCountry })
    expect(state.phase).toBe('summit')

    state = summitGame()
    const first = state.activeCountry
    const second = state.countryOrder.find((country) => country !== first)!
    state.countries[second].signed = true
    makeEligible(state, first)
    state = signTreaty(state, { type: 'SIGN_TREATY', country: first })
    expect(state.ending?.result).toBe('victory')
    expect(state.phase).toBe('ended')
  })

  it('passes the final summit turn and starts or ends the next round', () => {
    let state = summitGame()
    const first = state.activeCountry
    const second = state.countryOrder.find((country) => country !== first)!
    state.summitTurnsTaken[second] = true
    state = passSummit(state, { type: 'PASS_SUMMIT', country: first })
    expect(state.phase).toBe('aftermath')

    const oldRound = state.round
    state.firstPlayer = state.countryOrder.at(-1)!
    state = continueRound(state)
    expect(state.round).toBe(oldRound + 1)
    expect(state.firstPlayer).toBe(state.countryOrder[0])
    expect(state.phase).toBe('briefing')

    state.phase = 'aftermath'
    state.round = state.maxRounds
    state = continueRound(state)
    expect(state.ending?.result).toBe('defeat')
    expect(state.phase).toBe('ended')
  })

  it('finds pending countries and applies every immediate ending in priority order', () => {
    const state = game(3)
    expect(nextPendingCountry(state, (country) => country === state.countryOrder[1])).toBe(
      state.countryOrder[2],
    )
    expect(nextPendingCountry(state, () => true)).toBeNull()

    const pressure = game(2)
    pressure.countries.aravell.resources.fuel = 0
    finalizeTransition(pressure)
    expect(pressure.countries.aravell.underPressure).toBe(true)
    pressure.countries.aravell.resources.fuel = 1
    finalizeTransition(pressure)
    expect(pressure.countries.aravell.underPressure).toBe(false)

    const collapse = game(2)
    collapse.countries.aravell.civilianPopulation = 0
    expect(finalizeTransition(collapse).ending?.title).toBe('A country collapses')

    const disarmed = game(2)
    disarmed.countries.aravell.military = 0
    expect(finalizeTransition(disarmed).ending?.title).toBe('The front breaks')

    const unrest = game(2)
    unrest.globalUnrest = 10
    expect(finalizeTransition(unrest).ending?.title).toBe('The room loses the streets')

    const refugees = game(2)
    refugees.refugeePool = 11
    expect(finalizeTransition(refugees).ending?.title).toBe('The roads overflow')
  })
})
