import type { CrisisCard } from '../types'

export const CRISIS_CARDS: CrisisCard[] = [
  {
    id: 'winter-famine',
    title: 'The winter famine',
    location: 'Vellan lowlands',
    briefing:
      'The harvest failed behind three front lines. A shared grain convoy can still reach the cities before the roads freeze.',
    requirements: (n) => ({ food: Math.ceil(1.5 * n) }),
    success: {
      headline: 'The convoys arrive',
      detail: 'Bread lines shorten. Cooperation feels possible again.',
      peace: 2,
      unrest: -1,
      refugees: -1,
    },
    failure: {
      headline: 'The roads close',
      detail: 'Families abandon the frozen interior.',
      peace: -1,
      unrest: 2,
      refugees: (n) => n,
    },
  },
  {
    id: 'continental-blackout',
    title: 'Continental blackout',
    location: 'Northern power grid',
    briefing:
      'Sabotage and overuse have split the grid. Fuel deliveries must be pooled before the hospitals lose backup power.',
    requirements: (n) => ({ fuel: Math.ceil(1.25 * n) }),
    success: {
      headline: 'The grid holds',
      detail: 'Hospital windows remain lit through the night.',
      peace: 2,
      unrest: -1,
    },
    failure: {
      headline: 'The grid fractures',
      detail: 'Dark cities fill the radio with rumors.',
      peace: -1,
      unrest: 2,
      refugees: (n) => Math.ceil(n / 2),
    },
  },
  {
    id: 'broken-rail',
    title: 'The broken rail',
    location: 'Merev junction',
    briefing:
      'The only railway serving the relief corridor is twisted across the valley. Money and machinery are needed together.',
    requirements: (n) => ({ industry: n, capital: Math.ceil(n / 2) }),
    success: {
      headline: 'The junction reopens',
      detail: 'Freight moves under a joint flag.',
      peace: 2,
      unrest: -1,
      refugees: -1,
    },
    failure: {
      headline: 'The junction rusts',
      detail: 'The corridor becomes a footpath for the displaced.',
      peace: -1,
      unrest: 1,
      refugees: (n) => n,
    },
  },
  {
    id: 'camp-fever',
    title: 'Fever in the camps',
    location: 'Namarra coast',
    briefing:
      'A fast-moving fever has reached the largest refugee camp. Field kitchens and emergency finance can contain it.',
    requirements: (n) => ({ food: n, capital: n }),
    success: {
      headline: 'The fever breaks',
      detail: 'The wards empty without panic spreading inland.',
      peace: 2,
      unrest: -1,
      refugees: -2,
    },
    failure: {
      headline: 'Containment fails',
      detail: 'Every capital announces casualties by morning.',
      peace: -1,
      unrest: 2,
      civilianLoss: 1,
    },
  },
  {
    id: 'guns-at-dawn',
    title: 'Guns at dawn',
    location: 'The Vellan Pass',
    briefing:
      'Field commanders are preparing one final offensive. Only a visible, mutual stand-down can stop it.',
    requirements: (n) => ({ military: n }),
    success: {
      headline: 'The guns stay silent',
      detail: 'Brigades withdraw while observers count every vehicle.',
      peace: 3,
      unrest: -1,
    },
    failure: {
      headline: 'The barrage begins',
      detail: 'The offensive gains no ground and creates another column of wounded.',
      peace: -2,
      unrest: 2,
      refugees: (n) => Math.ceil(n / 2),
      militaryLoss: 1,
    },
  },
  {
    id: 'currency-panic',
    title: 'Currency panic',
    location: 'Belovar exchange',
    briefing:
      'War rumors have started a run on the region’s banks. A stabilization fund must be credible before markets open.',
    requirements: (n) => ({ capital: Math.ceil(1.5 * n) }),
    success: {
      headline: 'Markets steady',
      detail: 'The opening bell rings to cautious silence, not panic.',
      peace: 2,
      unrest: -1,
    },
    failure: {
      headline: 'Credit evaporates',
      detail: 'Savings disappear and hardliners find an audience.',
      peace: -1,
      unrest: 2,
    },
  },
]

export function getCrisis(id: string): CrisisCard {
  const card = CRISIS_CARDS.find((candidate) => candidate.id === id)
  if (!card) throw new Error(`Unknown crisis card: ${id}`)
  return card
}
