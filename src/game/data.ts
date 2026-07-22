import type { CountryId, CrisisCard, PolicyCard, Resource, ResourceBag } from './types'

export type CountryDefinition = {
  id: CountryId
  name: string
  epithet: string
  brief: string
  pressure: string
  mandateTitle: string
  mandate: string
  redLine: string
  start: ResourceBag
  civilianPopulation: number
  military: number
  color: string
  colorSoft: string
  monogram: string
}

export const RESOURCE_META: Record<Resource, { label: string; short: string }> = {
  food: { label: 'Food', short: 'FD' },
  industry: { label: 'Industry', short: 'IN' },
  fuel: { label: 'Fuel', short: 'FL' },
  capital: { label: 'Capital', short: 'CP' },
}

export const COUNTRY_DEFINITIONS: Record<CountryId, CountryDefinition> = {
  aravell: {
    id: 'aravell',
    name: 'Aravell',
    epithet: 'The industrial north',
    brief: 'Foundries, rail yards, and a government one blackout from collapse.',
    pressure: 'Energy security',
    mandateTitle: 'Keep the lights on',
    mandate: 'Hold at least 3 Fuel and 3 Capital.',
    redLine: 'Fuel may not fall to 0.',
    start: { food: 4, industry: 3, fuel: 1, capital: 3 },
    civilianPopulation: 8,
    military: 5,
    color: '#79a9d3',
    colorSoft: '#263f54',
    monogram: 'AR',
  },
  tomerin: {
    id: 'tomerin',
    name: 'Tomerin',
    epithet: 'The resource-rich south',
    brief: 'Oil fields, empty granaries, and streets already close to panic.',
    pressure: 'Food and calm',
    mandateTitle: 'Bread before banners',
    mandate: 'Hold at least 3 Food while Global Unrest is 4 or lower.',
    redLine: 'Global Unrest must remain below 7.',
    start: { food: 1, industry: 2, fuel: 4, capital: 3 },
    civilianPopulation: 8,
    military: 5,
    color: '#d98a52',
    colorSoft: '#503426',
    monogram: 'TO',
  },
  veyra: {
    id: 'veyra',
    name: 'Veyra',
    epithet: 'The western breadbasket',
    brief: 'The region’s farms, with neither the factories nor fuel for another winter.',
    pressure: 'Industrial future',
    mandateTitle: 'Build beyond the harvest',
    mandate: 'Hold at least 3 Industry and 2 Fuel.',
    redLine: 'Capital may not fall to 0.',
    start: { food: 5, industry: 1, fuel: 2, capital: 2 },
    civilianPopulation: 9,
    military: 4,
    color: '#a8b96b',
    colorSoft: '#3b4529',
    monogram: 'VE',
  },
  karsk: {
    id: 'karsk',
    name: 'Karsk',
    epithet: 'The eastern fortress',
    brief: 'A formidable army supporting a civilian economy near exhaustion.',
    pressure: 'Peace from strength',
    mandateTitle: 'Return with leverage',
    mandate: 'Keep at least 6 Military and 3 Capital.',
    redLine: 'Military must remain above 2.',
    start: { food: 2, industry: 4, fuel: 2, capital: 2 },
    civilianPopulation: 7,
    military: 7,
    color: '#c86c67',
    colorSoft: '#4d292c',
    monogram: 'KA',
  },
  belovar: {
    id: 'belovar',
    name: 'Belovar',
    epithet: 'The mercantile republic',
    brief: 'Banks and ports can finance peace, if public confidence holds.',
    pressure: 'Solvency and lives',
    mandateTitle: 'Protect the republic',
    mandate: 'Hold at least 6 Capital and 6 Civilian Population.',
    redLine: 'Civilian Population must remain above 3.',
    start: { food: 2, industry: 2, fuel: 1, capital: 5 },
    civilianPopulation: 8,
    military: 5,
    color: '#b89ad2',
    colorSoft: '#443653',
    monogram: 'BE',
  },
  namarra: {
    id: 'namarra',
    name: 'Namarra',
    epithet: 'The coastal refuge',
    brief: 'Open ports shelter the displaced while the state strains to absorb them.',
    pressure: 'Resettlement',
    mandateTitle: 'Make refuge a home',
    mandate: 'Reach 10 Civilian Population while Refugees are no more than 3 per country.',
    redLine: 'Refugees may not exceed 4 per country.',
    start: { food: 3, industry: 2, fuel: 3, capital: 2 },
    civilianPopulation: 9,
    military: 4,
    color: '#63b4aa',
    colorSoft: '#244b49',
    monogram: 'NA',
  },
}

export const POLICY_CARDS: PolicyCard[] = [
  {
    id: 'emergency-harvest',
    title: 'Emergency harvest',
    kicker: 'Production',
    description: 'Open strategic grain stores. Gain 3 Food.',
    gain: { food: 3 },
  },
  {
    id: 'factory-conversion',
    title: 'Factory conversion',
    kicker: 'Production',
    description: 'Spend 1 Capital to gain 3 Industry.',
    cost: { capital: 1 },
    gain: { industry: 3 },
  },
  {
    id: 'emergency-refining',
    title: 'Emergency refining',
    kicker: 'Production',
    description: 'Spend 1 Industry to gain 3 Fuel.',
    cost: { industry: 1 },
    gain: { fuel: 3 },
  },
  {
    id: 'reconstruction-bonds',
    title: 'Reconstruction bonds',
    kicker: 'Finance',
    description: 'Gain 3 Capital. The rushed levy raises Unrest by 1.',
    gain: { capital: 3 },
    unrestDelta: 1,
  },
  {
    id: 'demobilize-brigade',
    title: 'Demobilize a brigade',
    kicker: 'De-escalation',
    description: 'Move 1 Military back into civilian life and gain 1 Peace.',
    militaryDelta: -1,
    civilianDelta: 1,
    peaceDelta: 1,
  },
  {
    id: 'strategic-levy',
    title: 'Strategic levy',
    kicker: 'Security',
    description: 'Spend 1 Industry and 1 Fuel to gain 3 Military. Raise Unrest by 1.',
    cost: { industry: 1, fuel: 1 },
    militaryDelta: 3,
    unrestDelta: 1,
  },
  {
    id: 'relief-corridor',
    title: 'Relief corridor',
    kicker: 'Humanitarian',
    description: 'Spend 1 Food and 1 Capital to resettle up to 2 Refugees. Gain 1 Peace.',
    cost: { food: 1, capital: 1 },
    civilianDelta: 2,
    refugeeDelta: -2,
    peaceDelta: 1,
  },
  {
    id: 'public-reassurance',
    title: 'Public reassurance',
    kicker: 'Domestic',
    description: 'Spend 1 Capital to reduce Global Unrest by 2.',
    cost: { capital: 1 },
    unrestDelta: -2,
  },
  {
    id: 'state-visit',
    title: 'State visit',
    kicker: 'Diplomacy',
    description: 'Spend 1 Capital. Build 2 Trust with one country and reveal its mandate.',
    cost: { capital: 1 },
    requiresTarget: true,
    trustDelta: 2,
    peaceDelta: 1,
    revealMandate: true,
  },
  {
    id: 'medical-mission',
    title: 'Medical mission',
    kicker: 'Diplomacy',
    description: 'Spend 1 Food. Another country gains 1 Population; build 2 Trust.',
    cost: { food: 1 },
    requiresTarget: true,
    targetCivilianDelta: 1,
    trustDelta: 2,
    peaceDelta: 1,
  },
  {
    id: 'mutual-stand-down',
    title: 'Mutual stand-down',
    kicker: 'Diplomacy',
    description: 'Both countries demobilize 1 Military. Build 2 Trust and gain 2 Peace.',
    requiresTarget: true,
    militaryDelta: -1,
    targetMilitaryDelta: -1,
    trustDelta: 2,
    peaceDelta: 2,
  },
  {
    id: 'open-archives',
    title: 'Open the archives',
    kicker: 'Confidence',
    description: 'Reveal another mandate, build 1 Trust, and gain 1 Peace.',
    requiresTarget: true,
    trustDelta: 1,
    peaceDelta: 1,
    revealMandate: true,
  },
  {
    id: 'quiet-procurement',
    title: 'Quiet procurement',
    kicker: 'Logistics',
    description: 'Spend 1 Capital to gain 1 Industry and 1 Fuel.',
    cost: { capital: 1 },
    gain: { industry: 1, fuel: 1 },
  },
  {
    id: 'national-reserves',
    title: 'National reserves',
    kicker: 'Logistics',
    description: 'Release reserves. Gain 1 Food and 1 Fuel.',
    gain: { food: 1, fuel: 1 },
  },
  {
    id: 'civilian-conversion',
    title: 'Civilian conversion',
    kicker: 'Reconstruction',
    description: 'Demobilize 1 Military to gain 1 Industry, 1 Capital, and 1 Peace.',
    militaryDelta: -1,
    gain: { industry: 1, capital: 1 },
    peaceDelta: 1,
  },
  {
    id: 'ceasefire-line',
    title: 'Ceasefire line',
    kicker: 'De-escalation',
    description: 'Coordinate with another country. Build 1 Trust and reduce Unrest by 1.',
    requiresTarget: true,
    trustDelta: 1,
    unrestDelta: -1,
  },
]

export const CRISIS_CARDS: CrisisCard[] = [
  {
    id: 'winter-famine',
    title: 'The winter famine',
    location: 'Vellan lowlands',
    briefing: 'The harvest failed behind three front lines. A shared grain convoy can still reach the cities before the roads freeze.',
    requirements: (n) => ({ food: Math.ceil(1.5 * n) }),
    success: { headline: 'The convoys arrive', detail: 'Bread lines shorten. Cooperation feels possible again.', peace: 2, unrest: -1, refugees: -1 },
    failure: { headline: 'The roads close', detail: 'Families abandon the frozen interior.', peace: -1, unrest: 2, refugees: (n) => n },
  },
  {
    id: 'continental-blackout',
    title: 'Continental blackout',
    location: 'Northern power grid',
    briefing: 'Sabotage and overuse have split the grid. Fuel deliveries must be pooled before the hospitals lose backup power.',
    requirements: (n) => ({ fuel: Math.ceil(1.25 * n) }),
    success: { headline: 'The grid holds', detail: 'Hospital windows remain lit through the night.', peace: 2, unrest: -1 },
    failure: { headline: 'The grid fractures', detail: 'Dark cities fill the radio with rumors.', peace: -1, unrest: 2, refugees: (n) => Math.ceil(n / 2) },
  },
  {
    id: 'broken-rail',
    title: 'The broken rail',
    location: 'Merev junction',
    briefing: 'The only railway serving the relief corridor is twisted across the valley. Money and machinery are needed together.',
    requirements: (n) => ({ industry: n, capital: Math.ceil(n / 2) }),
    success: { headline: 'The junction reopens', detail: 'Freight moves under a joint flag.', peace: 2, unrest: -1, refugees: -1 },
    failure: { headline: 'The junction rusts', detail: 'The corridor becomes a footpath for the displaced.', peace: -1, unrest: 1, refugees: (n) => n },
  },
  {
    id: 'camp-fever',
    title: 'Fever in the camps',
    location: 'Namarra coast',
    briefing: 'A fast-moving fever has reached the largest refugee camp. Field kitchens and emergency finance can contain it.',
    requirements: (n) => ({ food: n, capital: n }),
    success: { headline: 'The fever breaks', detail: 'The wards empty without panic spreading inland.', peace: 2, unrest: -1, refugees: -2 },
    failure: { headline: 'Containment fails', detail: 'Every capital announces casualties by morning.', peace: -1, unrest: 2, civilianLoss: 1 },
  },
  {
    id: 'guns-at-dawn',
    title: 'Guns at dawn',
    location: 'The Vellan Pass',
    briefing: 'Field commanders are preparing one final offensive. Only a visible, mutual stand-down can stop it.',
    requirements: (n) => ({ military: n }),
    success: { headline: 'The guns stay silent', detail: 'Brigades withdraw while observers count every vehicle.', peace: 3, unrest: -1 },
    failure: { headline: 'The barrage begins', detail: 'The offensive gains no ground and creates another column of wounded.', peace: -2, unrest: 2, refugees: (n) => Math.ceil(n / 2), militaryLoss: 1 },
  },
  {
    id: 'currency-panic',
    title: 'Currency panic',
    location: 'Belovar exchange',
    briefing: 'War rumors have started a run on the region’s banks. A stabilization fund must be credible before markets open.',
    requirements: (n) => ({ capital: Math.ceil(1.5 * n) }),
    success: { headline: 'Markets steady', detail: 'The opening bell rings to cautious silence, not panic.', peace: 2, unrest: -1 },
    failure: { headline: 'Credit evaporates', detail: 'Savings disappear and hardliners find an audience.', peace: -1, unrest: 2 },
  },
]

export const MAX_TRACK = 10

export function getPolicy(id: string): PolicyCard {
  const card = POLICY_CARDS.find((candidate) => candidate.id === id)
  if (!card) throw new Error(`Unknown policy card: ${id}`)
  return card
}

export function getCrisis(id: string): CrisisCard {
  const card = CRISIS_CARDS.find((candidate) => candidate.id === id)
  if (!card) throw new Error(`Unknown crisis card: ${id}`)
  return card
}
