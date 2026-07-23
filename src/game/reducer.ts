import { COUNTRY_DEFINITIONS, MAX_TRACK, getCrisis, getPolicy } from './data'
import { runInvariants } from './invariants'
import {
  canPlayPolicy,
  getContributionTotals,
  getSigningStatus,
  isRedLineSafe,
} from './rules'
import {
  appendLog,
  applyPolicy,
  changeTrust,
  clamp,
  cloneGameState,
  dealPolicyHands,
} from './state'
import {
  type Commitment,
  type ContributionKey,
  type CountryId,
  type GameAction,
  type GameState,
  type Resource,
} from './types'

type ActionOf<Type extends GameAction['type']> = Extract<GameAction, { type: Type }>

function nextPendingCountry(
  state: GameState,
  completed: (country: CountryId) => boolean,
): CountryId | null {
  const start = state.countryOrder.indexOf(state.activeCountry)
  for (let offset = 1; offset <= state.countryOrder.length; offset += 1) {
    const candidate = state.countryOrder[(start + offset) % state.countryOrder.length]
    if (!completed(candidate)) return candidate
  }
  return null
}

function updatePressure(state: GameState): void {
  for (const country of state.countryOrder) {
    const safe = isRedLineSafe(state, country)
    const current = state.countries[country]
    if (!safe && !current.underPressure) {
      current.underPressure = true
      state.globalUnrest = clamp(state.globalUnrest + 1)
      appendLog(
        state,
        `${COUNTRY_DEFINITIONS[country].name} crosses a national red line. Global Unrest rises.`,
        country,
      )
    } else if (safe && current.underPressure) {
      current.underPressure = false
      appendLog(state, `${COUNTRY_DEFINITIONS[country].name} restores its national red line.`, country)
    }
  }
}

function getImmediateEnding(state: GameState): GameState['ending'] {
  const collapsed = state.countryOrder.find((country) => state.countries[country].civilianPopulation <= 0)
  if (collapsed) {
    return {
      result: 'defeat',
      title: 'A country collapses',
      reason: `${COUNTRY_DEFINITIONS[collapsed].name} has no Civilian Population left.`,
      epilogue:
        'A treaty cannot survive the disappearance of a state from the table. The remaining delegations leave before dawn.',
    }
  }
  const disarmed = state.countryOrder.find((country) => state.countries[country].military <= 0)
  if (disarmed) {
    return {
      result: 'defeat',
      title: 'The front breaks',
      reason: `${COUNTRY_DEFINITIONS[disarmed].name} has no Military left to hold the ceasefire line.`,
      epilogue:
        'One army dissolves before the signatures arrive. The vacuum draws every rival back toward the border.',
    }
  }
  if (state.globalUnrest >= MAX_TRACK) {
    return {
      result: 'defeat',
      title: 'The room loses the streets',
      reason: 'Global Unrest reached 10.',
      epilogue:
        'The radios fill with ultimatums. By the time the delegates agree on language, their governments no longer have permission to sign it.',
    }
  }
  if (state.refugeePool > 5 * state.playerCount) {
    return {
      result: 'defeat',
      title: 'The roads overflow',
      reason: `The Refugee Pool rose above ${5 * state.playerCount}.`,
      epilogue:
        'The conference becomes a footnote beside the largest movement of people the region has ever seen.',
    }
  }
  return null
}

function finalize(state: GameState): GameState {
  updatePressure(state)
  const ending = getImmediateEnding(state)
  if (ending) {
    state.ending = ending
    state.phase = 'ended'
  }
  runInvariants(state)
  return state
}

function contributionUnits(commitment: Commitment | undefined): number {
  return Object.values(commitment ?? {}).reduce((sum, value) => sum + (value ?? 0), 0)
}

function resolveCrisis(state: GameState): void {
  const crisis = getCrisis(state.currentCrisisId)
  const requirements = crisis.requirements(state.playerCount)
  const totals = getContributionTotals(state)
  const succeeded = Object.entries(requirements).every(
    ([key, requirement]) => (totals[key as ContributionKey] ?? 0) >= (requirement ?? 0),
  )
  const result = succeeded ? crisis.success : crisis.failure

  state.peaceMomentum = clamp(state.peaceMomentum + result.peace)
  state.globalUnrest = clamp(state.globalUnrest + result.unrest)
  if (succeeded) {
    state.refugeePool = Math.max(0, state.refugeePool + (crisis.success.refugees ?? 0))
  } else {
    state.refugeePool += crisis.failure.refugees?.(state.playerCount) ?? 0
    for (const country of state.countryOrder) {
      state.countries[country].civilianPopulation -= crisis.failure.civilianLoss ?? 0
      state.countries[country].military -= crisis.failure.militaryLoss ?? 0
    }
  }

  const totalRequired = contributionUnits(requirements)
  const responsibleAt = Math.max(1, Math.floor((totalRequired / state.playerCount) * 0.6))
  for (let first = 0; first < state.countryOrder.length; first += 1) {
    for (let second = first + 1; second < state.countryOrder.length; second += 1) {
      const firstCountry = state.countryOrder[first]
      const secondCountry = state.countryOrder[second]
      const firstUnits = contributionUnits(state.commitments[firstCountry])
      const secondUnits = contributionUnits(state.commitments[secondCountry])
      if (firstUnits >= responsibleAt && secondUnits >= responsibleAt) {
        changeTrust(state, firstCountry, secondCountry, 1)
      } else if ((firstUnits === 0) !== (secondUnits === 0)) {
        changeTrust(state, firstCountry, secondCountry, -1)
      }
    }
  }

  state.lastCrisisResult = {
    crisisId: crisis.id,
    succeeded,
    totals,
    requirements,
    headline: result.headline,
    detail: result.detail,
  }
  appendLog(state, `${crisis.title}: ${result.headline}.`)
}

function markSummitTurnAndAdvance(state: GameState, country: CountryId): void {
  state.summitTurnsTaken[country] = true
  const following = nextPendingCountry(state, (candidate) => Boolean(state.summitTurnsTaken[candidate]))
  if (following) {
    state.activeCountry = following
  } else {
    state.phase = 'aftermath'
    state.activeCountry = state.firstPlayer
    appendLog(state, `Round ${state.round} closes. The communiqués are drafted.`)
  }
}

function transferOne(state: GameState, from: CountryId, to: CountryId, resource: Resource): void {
  state.countries[from].resources[resource] -= 1
  state.countries[to].resources[resource] += 1
}

function allSigned(state: GameState): boolean {
  return state.countryOrder.every((country) => state.countries[country].signed)
}

function victoryEnding(state: GameState): GameState['ending'] {
  return {
    result: 'victory',
    title: 'The guns fall silent',
    reason: `All ${state.playerCount} countries signed with their mandates intact.`,
    epilogue:
      'No one cheers when the last pen leaves the paper. Along the Vellan front, radios go quiet one post at a time. By morning, trains carry grain instead of shells—and for the first time in years, the border is only a line on a map.',
  }
}

function advanceCabinet(state: GameState): GameState {
  const following = nextPendingCountry(state, (country) => Boolean(state.countries[country].policyPlayed))
  if (following) {
    state.activeCountry = following
  } else {
    state.phase = 'crisis'
    state.activeCountry = state.firstPlayer
    appendLog(state, 'Cabinet planning ends. Commitments to the shared crisis begin.')
  }
  return finalize(state)
}

function assertSummitTurn(state: GameState, country: CountryId): void {
  if (state.phase !== 'summit' || state.activeCountry !== country) {
    throw new Error('It is another country’s summit turn.')
  }
}

function acknowledgeBriefing(state: GameState): GameState {
  if (state.phase !== 'briefing') throw new Error('There is no briefing to acknowledge.')
  state.phase = 'cabinet'
  state.activeCountry = state.firstPlayer
  appendLog(state, `Round ${state.round} cabinet planning begins.`)
  return finalize(state)
}

function playPolicy(state: GameState, action: ActionOf<'PLAY_POLICY'>): GameState {
  const legal = canPlayPolicy(state, action.country, action.cardId, action.target)
  if (legal !== true) throw new Error(legal)
  applyPolicy(state, action.country, getPolicy(action.cardId), action.target)
  return advanceCabinet(state)
}

function conserveResources(state: GameState, action: ActionOf<'CONSERVE_RESOURCES'>): GameState {
  if (state.phase !== 'cabinet' || state.activeCountry !== action.country) {
    throw new Error('It is another country’s cabinet turn.')
  }
  state.countries[action.country].resources.capital += 1
  state.countries[action.country].policyPlayed = 'conserve-resources'
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} conserves resources and gains 1 Capital.`,
    action.country,
  )
  return advanceCabinet(state)
}

function submitCommitment(state: GameState, action: ActionOf<'SUBMIT_COMMITMENT'>): GameState {
  if (state.phase !== 'crisis') throw new Error('The crisis council is not accepting commitments.')
  if (state.activeCountry !== action.country) throw new Error('It is another country’s commitment window.')
  if (state.commitments[action.country]) throw new Error('This country has already committed.')
  const requirements = getCrisis(state.currentCrisisId).requirements(state.playerCount)
  const clean: Commitment = {}
  for (const [key, rawAmount] of Object.entries(action.commitment) as [ContributionKey, number][]) {
    const amount = Math.round(rawAmount)
    if (!Object.hasOwn(requirements, key)) throw new Error(`${key} is not requested by this crisis.`)
    if (amount < 0 || amount !== rawAmount) throw new Error('Commitments must be whole, non-negative units.')
    const available =
      key === 'military' ? state.countries[action.country].military : state.countries[action.country].resources[key]
    if (amount > available) throw new Error(`Not enough ${key} to commit.`)
    if (key === 'military' && available - amount <= 0) {
      throw new Error('A commitment cannot eliminate the country’s military.')
    }
    if (amount > 0) clean[key] = amount
  }
  for (const [key, amount] of Object.entries(clean) as [ContributionKey, number][]) {
    if (key === 'military') state.countries[action.country].military -= amount
    else state.countries[action.country].resources[key] -= amount
  }
  state.commitments[action.country] = clean
  appendLog(state, `${COUNTRY_DEFINITIONS[action.country].name} seals its crisis commitment.`, action.country)
  const following = nextPendingCountry(state, (country) => Boolean(state.commitments[country]))
  if (following) {
    state.activeCountry = following
  } else {
    resolveCrisis(state)
    state.phase = 'summit'
    state.activeCountry = state.firstPlayer
    appendLog(state, 'The crisis resolves. The peace summit opens.')
  }
  return finalize(state)
}

function postOffer(state: GameState, action: ActionOf<'POST_OFFER'>): GameState {
  assertSummitTurn(state, action.country)
  if (action.give === action.want) throw new Error('An exchange must name two different resources.')
  if (state.countries[action.country].resources[action.give] < 1) {
    throw new Error(`No ${action.give} is available to offer.`)
  }
  state.summitOffers[action.country] = {
    country: action.country,
    give: action.give,
    want: action.want,
  }
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} posts a ${action.give}-for-${action.want} proposal.`,
    action.country,
  )
  markSummitTurnAndAdvance(state, action.country)
  return finalize(state)
}

function acceptOffer(state: GameState, action: ActionOf<'ACCEPT_OFFER'>): GameState {
  assertSummitTurn(state, action.country)
  const offer = state.summitOffers[action.offerCountry]
  if (!offer || offer.country === action.country) throw new Error('That proposal is not available.')
  if (state.countries[offer.country].resources[offer.give] < 1) {
    throw new Error('The proposer can no longer honor that proposal.')
  }
  if (state.countries[action.country].resources[offer.want] < 1) {
    throw new Error(`You need 1 ${offer.want} to accept.`)
  }
  transferOne(state, offer.country, action.country, offer.give)
  transferOne(state, action.country, offer.country, offer.want)
  changeTrust(state, action.country, offer.country, 1)
  state.peaceMomentum = clamp(state.peaceMomentum + 1)
  delete state.summitOffers[action.offerCountry]
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} accepts ${COUNTRY_DEFINITIONS[offer.country].name}’s exchange.`,
    action.country,
  )
  markSummitTurnAndAdvance(state, action.country)
  return finalize(state)
}

function buildTrust(state: GameState, action: ActionOf<'BUILD_TRUST'>): GameState {
  assertSummitTurn(state, action.country)
  if (action.target === action.country || !state.countryOrder.includes(action.target)) {
    throw new Error('Choose another country.')
  }
  if (state.countries[action.country].resources.capital < 1) {
    throw new Error('A backchannel costs 1 Capital.')
  }
  state.countries[action.country].resources.capital -= 1
  changeTrust(state, action.country, action.target, 2)
  state.countries[action.target].mandateRevealed = true
  state.peaceMomentum = clamp(state.peaceMomentum + 1)
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} opens a backchannel with ${COUNTRY_DEFINITIONS[action.target].name}.`,
    action.country,
  )
  markSummitTurnAndAdvance(state, action.country)
  return finalize(state)
}

function signTreaty(state: GameState, action: ActionOf<'SIGN_TREATY'>): GameState {
  assertSummitTurn(state, action.country)
  const status = getSigningStatus(state, action.country)
  if (!status.eligible) throw new Error(status.reasons.join(' '))
  state.countries[action.country].signed = true
  state.peaceMomentum = clamp(state.peaceMomentum + 1)
  appendLog(state, `${COUNTRY_DEFINITIONS[action.country].name} signs the Vellan Accord.`, action.country)
  if (allSigned(state)) {
    state.ending = victoryEnding(state)
    state.phase = 'ended'
  } else {
    markSummitTurnAndAdvance(state, action.country)
  }
  return finalize(state)
}

function passSummit(state: GameState, action: ActionOf<'PASS_SUMMIT'>): GameState {
  assertSummitTurn(state, action.country)
  appendLog(
    state,
    `${COUNTRY_DEFINITIONS[action.country].name} closes its summit window without an agreement.`,
    action.country,
  )
  markSummitTurnAndAdvance(state, action.country)
  return finalize(state)
}

function continueRound(state: GameState): GameState {
  if (state.phase !== 'aftermath') throw new Error('The round is not ready to close.')
  if (state.round >= state.maxRounds) {
    const unsigned = state.countryOrder.filter((country) => !state.countries[country].signed)
    state.ending = {
      result: 'defeat',
      title: 'Peace arrives one round too late',
      reason: `${unsigned.map((country) => COUNTRY_DEFINITIONS[country].name).join(', ')} did not sign by the end of Round ${state.maxRounds}.`,
      epilogue:
        'By morning, every delegation can describe the agreement they should have made. The front does not wait for hindsight.',
    }
    state.phase = 'ended'
    return finalize(state)
  }
  const formerFirst = state.countryOrder.indexOf(state.firstPlayer)
  state.firstPlayer = state.countryOrder[(formerFirst + 1) % state.countryOrder.length]
  state.activeCountry = state.firstPlayer
  state.round += 1
  state.phase = 'briefing'
  state.currentCrisisId = state.crisisDeck[0]
  state.crisisDeck = state.crisisDeck.slice(1)
  state.commitments = {}
  state.summitOffers = {}
  state.summitTurnsTaken = {}
  state.lastCrisisResult = null
  dealPolicyHands(state)
  appendLog(
    state,
    `Round ${state.round} begins. ${COUNTRY_DEFINITIONS[state.firstPlayer].name} now holds the chair.`,
  )
  return finalize(state)
}

export function reduceGame(state: GameState, action: GameAction): GameState {
  if (state.ending) throw new Error('The game has already ended.')
  const next = cloneGameState(state)

  switch (action.type) {
    case 'ACKNOWLEDGE_BRIEFING':
      return acknowledgeBriefing(next)
    case 'PLAY_POLICY':
      return playPolicy(next, action)
    case 'CONSERVE_RESOURCES':
      return conserveResources(next, action)
    case 'SUBMIT_COMMITMENT':
      return submitCommitment(next, action)
    case 'POST_OFFER':
      return postOffer(next, action)
    case 'ACCEPT_OFFER':
      return acceptOffer(next, action)
    case 'BUILD_TRUST':
      return buildTrust(next, action)
    case 'SIGN_TREATY':
      return signTreaty(next, action)
    case 'PASS_SUMMIT':
      return passSummit(next, action)
    case 'CONTINUE_ROUND':
      return continueRound(next)
  }
}
