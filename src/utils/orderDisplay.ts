import type { TranslationKey } from '../i18n/de.js'

export function orderShortId(orderId: string): string {
  return orderId.replace(/-/g, '').slice(0, 8).toUpperCase()
}

export function formatOrderDisplayId(orderId: string): string {
  const short = orderShortId(orderId)
  if (short.length <= 3) return `#${short}`
  return `#${short.slice(0, 3)} ${short.slice(3, 6)}`
}

const STATUS_LABELS: Record<string, TranslationKey> = {
  pending: 'statusPending',
  new: 'statusPending',
  accepted: 'statusAccepted',
  assigned: 'statusAccepted',
  acknowledged: 'statusAccepted',
  preparing: 'statusPreparing',
  ready: 'statusReady',
  ready_for_pickup: 'statusReadyPickup',
  out_for_delivery: 'statusOnTheWay',
  courier_assigned: 'statusOnTheWay',
  delivered: 'statusDelivered',
  completed: 'statusDelivered',
  picked_up: 'statusPickedUp',
  rejected: 'statusRejected',
  cancelled: 'statusCancelled',
}

export function getStatusLabelKey(status: string): TranslationKey {
  return STATUS_LABELS[status] ?? 'statusUnknown'
}
