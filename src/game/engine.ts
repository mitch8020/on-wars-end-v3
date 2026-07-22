import { COUNTRY_DEFINITIONS, CRISIS_CARDS, MAX_TRACK, POLICY_CARDS, getCrisis, getPolicy } from './data'
import {
  COUNTRY_IDS,
  RESOURCES,
  type Commitment,
  type ContributionKey,
  type CountryId,
  type CountryState,
  type GameAction,
  type GameState,
  type PolicyCard,
  type Resource,
  type SetupOptions,
  type TrustMap,
} from './types'

const UINT32 = 0x100000000

function nextRandom(rngState: number): [number, number] {
  let value = rngState >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  const next = value >>> 0 || 0x6d2b79f5
  return [next / UINT32, next]
}

function shuffle<T>(values: T[], rngState: number): [T[], number] {
  const shuffled = [...values]
  let rng = rngState
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    let random
    ;[random, rng] = nextRandom(rng)
    const other = Math.floor(random * (index + 1))
    ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
  }
  return [shuffled, rng]
}

function clamp(value: number, minimum = 0, maximum = MAX_TRACK): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function cloneState(state: GameState): GameState {
  return structuredClone(state)
}

export function trustKey(first: CountryId, second: CountryId): string {
  return first < second ? `${first}:${second}` : `${second}:${first}`
}

export function getTrust(state: GameState, first: CountryId, second: CountryId): number {
  if (first === second) return 4
  return state.trust[trustKey(first, second)] ?? 0
}

function setTrust(state: GameState, first: CountryId, second: CountryId, value: number): void {
  if (first === second) return
  state.trust[trustKey(first, second)] = clamp(value, 0, 4)
}

function changeTrust(state: GameState, first: CountryId, second: CountryId, amount: number): void {
  setTrust(state, first, second, getTrust(state, first, second) + amount)
}

export function averageTrust(state: GameState, country: CountryId): number {
  const others = state.countryOrder.filter((candidate) => candidate !== country)
  if (others.length === 0) return 4
  return others.reduce((sum, candidate) => sum + getTrust(state, country, candidate), 0) / others.length
}

function createTrustMap(countryOrder: CountryId[]): TrustMap {
  const trust: TrustMap = {}
  for (let first = 0; first < countryOrder.length; first += 1) {
    for (let second = first + 1; second < countryOrder.length; second += 1) {
      const firstCountry = countryOrder[first]
      const secondCountry = countryOrder[second]
      const naturalPartners =
        (firstCountry === 'aravell' && secondCountry === 'veyra') ||
        (firstCountry === 'tomerin' && secondCountry === 'namarra') ||
        (firstCountry === 'belovar' && secondCountry === 'karsk')
      trust[trustKey(firstCountry, secondCountry)] = naturalPartners ? 2 : 1
    }
  }
  return trust
}

function createCountry(id: CountryId): CountryState {
  const definition = COUNTRY_DEFINITIONS[id]
  return {
    id,
    resources: { ...definition.start },
    civilianPopulation: definition.civilianPopulation,
    military: definition.military,
    signed: false,
    underPressure: false,
    mandateRevealed: false,
    policyHand: [],
    policyPlayed: null,
  }
}

function log(state: GameState, message: string, country?: CountryId): void {
  state.log.push({
    id: state.log.length,
    round: state.round,
    phase: state.phase,
    country,
    message,
  })
}

function dealPolicyHands(state: GameState): void {
  const policyIds = POLICY_CARDS.map((policy) => policy.id)
  for (const country of state.countryOrder) {
    let shuffled
    ;[shuffled, state.rngState] = shuffle(policyIds, state.rngState)
    state.countries[country].policyHand = shuffled.slice(0, 3)
    state.countries[country].policyPlayed = null
  }
}

export function setupGame(options: SetupOptions): GameState {
  const playerCount = clamp(Math.round(options.playerCount), 2, 6)
  const countryOrder = COUNTRY_IDS.slice(0, playerCount) as CountryId[]
  const humanCountry = countryOrder.includes(options.humanCountry) ? options.humanCountry : countryOrder[0]
  const seed = (Math.abs(Math.round(options.seed)) || 1) >>> 0
  const [crisisIds, shuffledRngState] = shuffle(CRISIS_CARDS.map((crisis) => crisis.id), seed)
  let rngState = shuffledRngState

  let firstPlayer: CountryId = 'aravell'
  if (playerCount > 2) {
    let random
    ;[random, rngState] = nextRandom(rngState)
    firstPlayer = countryOrder[Math.floor(random * countryOrder.length)]
  }

  const countries = Object.fromEntries(COUNTRY_IDS.map((id) => [id, createCountry(id)])) as Record<CountryId, CountryState>
  const controllers = Object.fromEntries(
    COUNTRY_IDS.map((id) => [id, options.mode === 'hotseat' || id === humanCountry ? 'human' : 'ai']),
  ) as GameState['controllers']

  const state: GameState = {
    version: '3.0',
    seed,
    rngState,
    playerCount,
    mode: options.mode,
    humanCountry: options.mode === 'solo' ? humanCountry : null,
    controllers,
    countryOrder,
    round: 1,
    maxRounds: 6,
    phase: 'briefing',
    firstPlayer,
    activeCountry: firstPlayer,
    countries,
    globalUnrest: 3,
    peaceMomentum: 1,
    refugeePool: 2 * playerCount,
    trust: createTrustMap(countryOrder),
    crisisDeck: crisisIds.slice(1),
    currentCrisisId: crisisIds[0],
    commitments: {},
    summitOffers: {},
    summitTurnsTaken: {},
    lastCrisisResult: null,
    log: [],
    ending: null,
  }
  dealPolicyHands(state)
  log(state, `${COUNTRY_DEFINITIONS[firstPlayer].name} will open the first cabinet session.`)
  runInvariants(state)
  return state
}

export function isRedLineSafe(state: GameState, country: CountryId): boolean {
  const current = state.countries[country]
  switch (country) {
    case 'aravell':
      return current.resources.fuel > 0
    case 'tomerin':
      return state.globalUnrest < 7
    case 'veyra':
      return current.resources.capital > 0
    case 'karsk':
      return current.military > 2
    case 'belovar':
      return current.civilianPopulation > 3
    case 'namarra':
      return state.refugeePool <= 4 * state.playerCount
  }
}

export function isMandateMet(state: GameState, country: CountryId): boolean {
  const current = state.countries[country]
  switch (country) {
    case 'aravell':
      return current.resources.fuel >= 3 && current.resources.capital >= 3
    case 'tomerin':
      return current.resources.food >= 3 && state.globalUnrest <= 4
    case 'veyra':
      return current.resources.industry >= 3 && current.resources.fuel >= 2
    case 'karsk':
      return current.military >= 6 && current.resources.capital >= 3
    case 'belovar':
      return current.resources.capital >= 6 && current.civilianPopulation >= 6
    case 'namarra':
      return current.civilianPopulation >= 10 && state.refugeePool <= 3 * state.playerCount
  }
}

export type SigningStatus = { eligible: boolean; reasons: string[] }

export function getSigningStatus(state: GameState, country: CountryId): SigningStatus {
  const current = state.countries[country]
  if (current.signed) return { eligible: false, reasons: ['Treaty already signed'] }
  const reasons: string[] = []
  if (!isMandateMet(state, country)) reasons.push('National mandate is not met')
  if (!isRedLineSafe(state, country) || current.underPressure) reasons.push('A national red line is under pressure')
  if (state.peaceMomentum < 6) reasons.push(`Peace needs ${6 - state.peaceMomentum} more momentum`)
  const trust = averageTrust(state, country)
  if (trust < 2) reasons.push(`Average Trust is ${trust.toFixed(1)}; it must reach 2.0`)
  return { eligible: reasons.length === 0, reasons }
}

function hasResources(country: CountryState, cost: Partial<Record<Resource, number>>): boolean {
  return RESOURCES.every((resource) => country.resources[resource] >= (cost[resource] ?? 0))
}

export function canPlayPolicy(state: GameState, country: CountryId, cardId: string, target?: CountryId): string | true {
  if (state.phase !== 'cabinet') return 'Cabinet is not in session.'
  if (state.activeCountry !== country) return 'It is another country’s turn.'
  const current = state.countries[country]
  if (!current.policyHand.includes(cardId)) return 'That policy is not in this cabinet hand.'
  const policy = getPolicy(cardId)
  if (!hasResources(current, policy.cost ?? {})) return 'The policy cost cannot be paid.'
  if (policy.requiresTarget && (!target || target === country || !state.countryOrder.includes(target))) {
    return 'Choose another country.'
  }
  if ((policy.militaryDelta ?? 0) < 0 && current.military + (policy.militaryDelta ?? 0) <= 0) {
    return 'This would leave the country without a military.'
  }
  if (target && (policy.targetMilitaryDelta ?? 0) < 0 && state.countries[target].military + (policy.targetMilitaryDelta ?? 0) <= 0) {
    return 'This would leave the partner without a military.'
  }
  if (policy.id === 'relief-corridor' && state.refugeePool === 0) return 'There are no refugees to resettle.'
  return true
}

function spendResources(country: CountryState, cost: Partial<Record<Resource, number>>): void {
  for (const resource of RESOURCES) country.resources[resource] -= cost[resource] ?? 0
}

function gainResources(country: CountryState, gain: Partial<Record<Resource, number>>): void {
  for (const resource of RESOURCES) country.resources[resource] += gain[resource] ?? 0
}

function applyPolicy(state: GameState, country: CountryId, policy: PolicyCard, target?: CountryId): void {
  const current = state.countries[country]
  spendResources(current, policy.cost ?? {})
  gainResources(current, policy.gain ?? {})

  if (policy.id === 'relief-corridor') {
    const resettled = Math.min(2, state.refugeePool)
    state.refugeePool -= resettled
    current.civilianPopulation += resettled
  } else {
    current.civilianPopulation += policy.civilianDelta ?? 0
    state.refugeePool = Math.max(0, state.refugeePool + (policy.refugeeDelta ?? 0))
  }
  current.military += policy.militaryDelta ?? 0
  state.globalUnrest = clamp(state.globalUnrest + (policy.unrestDelta ?? 0))
  state.peaceMomentum = clamp(state.peaceMomentum + (policy.peaceDelta ?? 0))

  if (target) {
    const partner = state.countries[target]
    partner.civilianPopulation += policy.targetCivilianDelta ?? 0
    partner.military += policy.targetMilitaryDelta ?? 0
    if (policy.trustDelta) changeTrust(state, country, target, policy.trustDelta)
    if (policy.revealMandate) partner.mandateRevealed = true
  }
  current.policyPlayed = policy.id
  log(state, `${COUNTRY_DEFINITIONS[country].name} enacts ${policy.title}.`, country)
}

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
      log(state, `${COUNTRY_DEFINITIONS[country].name} crosses a national red line. Global Unrest rises.`, country)
    } else if (safe && current.underPressure) {
      current.underPressure = false
      log(state, `${COUNTRY_DEFINITIONS[country].name} restores its national red line.`, country)
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
      epilogue: 'A treaty cannot survive the disappearance of a state from the table. The remaining delegations leave before dawn.',
    }
  }
  const disarmed = state.countryOrder.find((country) => state.countries[country].military <= 0)
  if (disarmed) {
    return {
      result: 'defeat',
      title: 'The front breaks',
      reason: `${COUNTRY_DEFINITIONS[disarmed].name} has no Military left to hold the ceasefire line.`,
      epilogue: 'One army dissolves before the signatures arrive. The vacuum draws every rival back toward the border.',
    }
  }
  if (state.globalUnrest >= MAX_TRACK) {
    return {
      result: 'defeat',
      title: 'The room loses the streets',
      reason: 'Global Unrest reached 10.',
      epilogue: 'The radios fill with ultimatums. By the time the delegates agree on language, their governments no longer have permission to sign it.',
    }
  }
  if (state.refugeePool > 5 * state.playerCount) {
    return {
      result: 'defeat',
      title: 'The roads overflow',
      reason: `The Refugee Pool rose above ${5 * state.playerCount}.`,
      epilogue: 'The conference becomes a footnote beside the largest movement of people the region has ever seen.',
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

export function getContributionTotals(state: GameState): Commitment {
  const totals: Commitment = {}
  for (const contribution of Object.values(state.commitments)) {
    if (!contribution) continue
    for (const [key, amount] of Object.entries(contribution) as [ContributionKey, number][]) {
      totals[key] = (totals[key] ?? 0) + amount
    }
  }
  return totals
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
  log(state, `${crisis.title}: ${result.headline}.`)
}

function markSummitTurnAndAdvance(state: GameState, country: CountryId): void {
  state.summitTurnsTaken[country] = true
  const following = nextPendingCountry(state, (candidate) => Boolean(state.summitTurnsTaken[candidate]))
  if (following) {
    state.activeCountry = following
  } else {
    state.phase = 'aftermath'
    state.activeCountry = state.firstPlayer
    log(state, `Round ${state.round} closes. The communiqués are drafted.`)
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

export function reduceGame(state: GameState, action: GameAction): GameState {
  if (state.ending) throw new Error('The game has already ended.')
  const next = cloneState(state)

  switch (action.type) {
    case 'ACKNOWLEDGE_BRIEFING': {
      if (next.phase !== 'briefing') throw new Error('There is no briefing to acknowledge.')
      next.phase = 'cabinet'
      next.activeCountry = next.firstPlayer
      log(next, `Round ${next.round} cabinet planning begins.`)
      return finalize(next)
    }
    case 'PLAY_POLICY': {
      const legal = canPlayPolicy(next, action.country, action.cardId, action.target)
      if (legal !== true) throw new Error(legal)
      applyPolicy(next, action.country, getPolicy(action.cardId), action.target)
      const following = nextPendingCountry(next, (country) => Boolean(next.countries[country].policyPlayed))
      if (following) {
        next.activeCountry = following
      } else {
        next.phase = 'crisis'
        next.activeCountry = next.firstPlayer
        log(next, 'Cabinet planning ends. Commitments to the shared crisis begin.')
      }
      return finalize(next)
    }
    case 'CONSERVE_RESOURCES': {
      if (next.phase !== 'cabinet' || next.activeCountry !== action.country) throw new Error('It is another country’s cabinet turn.')
      next.countries[action.country].resources.capital += 1
      next.countries[action.country].policyPlayed = 'conserve-resources'
      log(next, `${COUNTRY_DEFINITIONS[action.country].name} conserves resources and gains 1 Capital.`, action.country)
      const following = nextPendingCountry(next, (country) => Boolean(next.countries[country].policyPlayed))
      if (following) {
        next.activeCountry = following
      } else {
        next.phase = 'crisis'
        next.activeCountry = next.firstPlayer
        log(next, 'Cabinet planning ends. Commitments to the shared crisis begin.')
      }
      return finalize(next)
    }
    case 'SUBMIT_COMMITMENT': {
      if (next.phase !== 'crisis') throw new Error('The crisis council is not accepting commitments.')
      if (next.activeCountry !== action.country) throw new Error('It is another country’s commitment window.')
      if (next.commitments[action.country]) throw new Error('This country has already committed.')
      const requirements = getCrisis(next.currentCrisisId).requirements(next.playerCount)
      const clean: Commitment = {}
      for (const [key, rawAmount] of Object.entries(action.commitment) as [ContributionKey, number][]) {
        const amount = Math.round(rawAmount)
        if (!Object.hasOwn(requirements, key)) throw new Error(`${key} is not requested by this crisis.`)
        if (amount < 0 || amount !== rawAmount) throw new Error('Commitments must be whole, non-negative units.')
        const available = key === 'military' ? next.countries[action.country].military : next.countries[action.country].resources[key]
        if (amount > available) throw new Error(`Not enough ${key} to commit.`)
        if (key === 'military' && available - amount <= 0) throw new Error('A commitment cannot eliminate the country’s military.')
        if (amount > 0) clean[key] = amount
      }
      for (const [key, amount] of Object.entries(clean) as [ContributionKey, number][]) {
        if (key === 'military') next.countries[action.country].military -= amount
        else next.countries[action.country].resources[key] -= amount
      }
      next.commitments[action.country] = clean
      log(next, `${COUNTRY_DEFINITIONS[action.country].name} seals its crisis commitment.`, action.country)
      const following = nextPendingCountry(next, (country) => Boolean(next.commitments[country]))
      if (following) {
        next.activeCountry = following
      } else {
        resolveCrisis(next)
        next.phase = 'summit'
        next.activeCountry = next.firstPlayer
        log(next, 'The crisis resolves. The peace summit opens.')
      }
      return finalize(next)
    }
    case 'POST_OFFER': {
      if (next.phase !== 'summit' || next.activeCountry !== action.country) throw new Error('It is another country’s summit turn.')
      if (action.give === action.want) throw new Error('An exchange must name two different resources.')
      if (next.countries[action.country].resources[action.give] < 1) throw new Error(`No ${action.give} is available to offer.`)
      next.summitOffers[action.country] = { country: action.country, give: action.give, want: action.want }
      log(next, `${COUNTRY_DEFINITIONS[action.country].name} posts a ${action.give}-for-${action.want} proposal.`, action.country)
      markSummitTurnAndAdvance(next, action.country)
      return finalize(next)
    }
    case 'ACCEPT_OFFER': {
      if (next.phase !== 'summit' || next.activeCountry !== action.country) throw new Error('It is another country’s summit turn.')
      const offer = next.summitOffers[action.offerCountry]
      if (!offer || offer.country === action.country) throw new Error('That proposal is not available.')
      if (next.countries[offer.country].resources[offer.give] < 1) throw new Error('The proposer can no longer honor that proposal.')
      if (next.countries[action.country].resources[offer.want] < 1) throw new Error(`You need 1 ${offer.want} to accept.`)
      transferOne(next, offer.country, action.country, offer.give)
      transferOne(next, action.country, offer.country, offer.want)
      changeTrust(next, action.country, offer.country, 1)
      next.peaceMomentum = clamp(next.peaceMomentum + 1)
      delete next.summitOffers[action.offerCountry]
      log(next, `${COUNTRY_DEFINITIONS[action.country].name} accepts ${COUNTRY_DEFINITIONS[offer.country].name}’s exchange.`, action.country)
      markSummitTurnAndAdvance(next, action.country)
      return finalize(next)
    }
    case 'BUILD_TRUST': {
      if (next.phase !== 'summit' || next.activeCountry !== action.country) throw new Error('It is another country’s summit turn.')
      if (action.target === action.country || !next.countryOrder.includes(action.target)) throw new Error('Choose another country.')
      if (next.countries[action.country].resources.capital < 1) throw new Error('A backchannel costs 1 Capital.')
      next.countries[action.country].resources.capital -= 1
      changeTrust(next, action.country, action.target, 2)
      next.countries[action.target].mandateRevealed = true
      next.peaceMomentum = clamp(next.peaceMomentum + 1)
      log(next, `${COUNTRY_DEFINITIONS[action.country].name} opens a backchannel with ${COUNTRY_DEFINITIONS[action.target].name}.`, action.country)
      markSummitTurnAndAdvance(next, action.country)
      return finalize(next)
    }
    case 'SIGN_TREATY': {
      if (next.phase !== 'summit' || next.activeCountry !== action.country) throw new Error('It is another country’s summit turn.')
      const status = getSigningStatus(next, action.country)
      if (!status.eligible) throw new Error(status.reasons.join(' '))
      next.countries[action.country].signed = true
      next.peaceMomentum = clamp(next.peaceMomentum + 1)
      log(next, `${COUNTRY_DEFINITIONS[action.country].name} signs the Vellan Accord.`, action.country)
      if (allSigned(next)) {
        next.ending = victoryEnding(next)
        next.phase = 'ended'
      } else {
        markSummitTurnAndAdvance(next, action.country)
      }
      return finalize(next)
    }
    case 'PASS_SUMMIT': {
      if (next.phase !== 'summit' || next.activeCountry !== action.country) throw new Error('It is another country’s summit turn.')
      log(next, `${COUNTRY_DEFINITIONS[action.country].name} closes its summit window without an agreement.`, action.country)
      markSummitTurnAndAdvance(next, action.country)
      return finalize(next)
    }
    case 'CONTINUE_ROUND': {
      if (next.phase !== 'aftermath') throw new Error('The round is not ready to close.')
      if (next.round >= next.maxRounds) {
        const unsigned = next.countryOrder.filter((country) => !next.countries[country].signed)
        next.ending = {
          result: 'defeat',
          title: 'Peace arrives one round too late',
          reason: `${unsigned.map((country) => COUNTRY_DEFINITIONS[country].name).join(', ')} did not sign by the end of Round ${next.maxRounds}.`,
          epilogue: 'By morning, every delegation can describe the agreement they should have made. The front does not wait for hindsight.',
        }
        next.phase = 'ended'
        return finalize(next)
      }
      const formerFirst = next.countryOrder.indexOf(next.firstPlayer)
      next.firstPlayer = next.countryOrder[(formerFirst + 1) % next.countryOrder.length]
      next.activeCountry = next.firstPlayer
      next.round += 1
      next.phase = 'briefing'
      next.currentCrisisId = next.crisisDeck[0]
      next.crisisDeck = next.crisisDeck.slice(1)
      next.commitments = {}
      next.summitOffers = {}
      next.summitTurnsTaken = {}
      next.lastCrisisResult = null
      dealPolicyHands(next)
      log(next, `Round ${next.round} begins. ${COUNTRY_DEFINITIONS[next.firstPlayer].name} now holds the chair.`)
      return finalize(next)
    }
  }
}

export function runInvariants(state: GameState): void {
  if (state.version !== '3.0') throw new Error('Unsupported game-state version.')
  if (state.countryOrder.length !== state.playerCount) throw new Error('Player count and country order disagree.')
  if (new Set(state.countryOrder).size !== state.countryOrder.length) throw new Error('A country appears twice in the roster.')
  if (!state.countryOrder.includes(state.activeCountry)) throw new Error('The active country is not in play.')
  if (!state.countryOrder.includes(state.firstPlayer)) throw new Error('The first player is not in play.')
  if (state.globalUnrest < 0 || state.globalUnrest > MAX_TRACK) throw new Error('Global Unrest left its track.')
  if (state.peaceMomentum < 0 || state.peaceMomentum > MAX_TRACK) throw new Error('Peace Momentum left its track.')
  if (state.refugeePool < 0) throw new Error('The Refugee Pool became negative.')
  for (const country of state.countryOrder) {
    const current = state.countries[country]
    for (const resource of RESOURCES) {
      if (!Number.isInteger(current.resources[resource]) || current.resources[resource] < 0) {
        throw new Error(`${country} has an invalid ${resource} count.`)
      }
    }
    if (!Number.isInteger(current.civilianPopulation) || !Number.isInteger(current.military)) {
      throw new Error(`${country} has a fractional population track.`)
    }
  }
  for (const value of Object.values(state.trust)) {
    if (!Number.isInteger(value) || value < 0 || value > 4) throw new Error('A Trust edge left its track.')
  }
  if ((state.phase === 'ended') !== Boolean(state.ending)) throw new Error('Ended phase and ending record disagree.')
}
