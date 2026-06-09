import type { Order } from '../types/order.js'

export type OrderTab = 'new' | 'progress' | 'ready' | 'done' | 'scheduled'

const PROGRESS = new Set(['accepted', 'preparing', 'assigned', 'acknowledged'])
const READY = new Set(['ready_for_pickup', 'ready'])
const DONE = new Set([
  'picked_up',
  'delivered',
  'completed',
  'out_for_delivery',
  'rejected',
  'cancelled',
])

export function isScheduledOrder(order: Order, now = Date.now()): boolean {
  if (!order.scheduledFor) return false
  const at = new Date(order.scheduledFor).getTime()
  if (Number.isNaN(at)) return false
  const pending = order.status === 'pending' || order.status === 'new'
  return pending && at > now
}

export function bucketOrder(order: Order, now = Date.now()): OrderTab {
  if (isScheduledOrder(order, now)) return 'scheduled'
  const status = order.status
  if (status === 'pending' || status === 'new') return 'new'
  if (PROGRESS.has(status)) return 'progress'
  if (READY.has(status)) return 'ready'
  if (DONE.has(status)) return 'done'
  return 'done'
}

export const TAB_LABELS: Record<OrderTab, string> = {
  new: 'Neu',
  progress: 'In Arbeit',
  ready: 'Fertig',
  done: 'Erledigt',
  scheduled: 'Geplant',
}
