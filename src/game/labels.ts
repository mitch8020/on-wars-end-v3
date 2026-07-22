import { RESOURCE_META } from './data'
import type { ContributionKey, Resource } from './types'

export function resourceLabel(resource: ContributionKey | 'population'): string {
  if (resource === 'military') return 'Military'
  if (resource === 'population') return 'Population'
  return RESOURCE_META[resource as Resource].label
}
