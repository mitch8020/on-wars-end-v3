import {
  CircleDollarSign,
  Factory,
  Fuel,
  Shield,
  Users,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import { resourceLabel } from '../game/labels'
import type { ContributionKey } from '../game/types'

const ICONS: Record<ContributionKey | 'population', LucideIcon> = {
  food: Wheat,
  industry: Factory,
  fuel: Fuel,
  capital: CircleDollarSign,
  military: Shield,
  population: Users,
}

type ResourceMarkProps = {
  resource: ContributionKey | 'population'
  value?: number
  compact?: boolean
  label?: string
  tone?: 'default' | 'muted' | 'danger'
}

export function ResourceMark({ resource, value, compact = false, label, tone = 'default' }: ResourceMarkProps) {
  const Icon = ICONS[resource]
  const resolvedLabel = label ?? resourceLabel(resource)
  return (
    <span className={`resource-mark resource-${resource} tone-${tone}`} title={value === undefined ? resolvedLabel : `${resolvedLabel}: ${value}`}>
      <Icon aria-hidden="true" size={compact ? 14 : 16} strokeWidth={1.8} />
      {value !== undefined && <strong>{value}</strong>}
      {!compact && <span>{resolvedLabel}</span>}
    </span>
  )
}
