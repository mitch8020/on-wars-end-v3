import type { CountryId, ResourceBag } from '../types'

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
