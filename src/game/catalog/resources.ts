import type { Resource } from '../types'

export const RESOURCE_META: Record<Resource, { label: string; short: string }> = {
  food: { label: 'Food', short: 'FD' },
  industry: { label: 'Industry', short: 'IN' },
  fuel: { label: 'Fuel', short: 'FL' },
  capital: { label: 'Capital', short: 'CP' },
}
