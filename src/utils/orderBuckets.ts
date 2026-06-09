import type { Order } from '../types/order.js'
import { getOrderDeadlineMs, isPendingOrder } from './orderCountdown.js'

export type OrderTab = 'active' | 'transit' | 'done'

const TRANSIT = new Set(['out_for_delivery', 'courier_assigned'])
const DONE = new Set([
  'picked_up',
  'delivered',
  'completed',
  'rejected',
  'cancelled',
])
const ACTIVE = new Set([
  'pending',
  'new',
  'accepted',
  'preparing',
  'assigned',
  'acknowledged',
  'ready_for_pickup',
  'ready',
])

export function bucketOrder(order: Order): OrderTab {
  const status = order.status
  if (isPendingOrder(order)) return 'active'
  if (TRANSIT.has(status)) return 'transit'
  if (DONE.has(status)) return 'done'
  if (ACTIVE.has(status)) return 'active'
  return 'done'
}

export function sortActiveOrders(orders: Order[], now = Date.now()): Order[] {
  return [...orders].sort((a, b) => {
    const aPending = isPendingOrder(a)
    const bPending = isPendingOrder(b)
    if (aPending !== bPending) return aPending ? -1 : 1
    if (aPending && bPending) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    return getOrderDeadlineMs(a, now) - getOrderDeadlineMs(b, now)
  })
}

export function sortTransitOrders(orders: Order[], now = Date.now()): Order[] {
  return [...orders].sort(
    (a, b) => getOrderDeadlineMs(a, now) - getOrderDeadlineMs(b, now),
  )
}

export function sortDoneOrders(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function sortOrdersForTab(orders: Order[], tab: OrderTab, now = Date.now()): Order[] {
  if (tab === 'active') return sortActiveOrders(orders, now)
  if (tab === 'transit') return sortTransitOrders(orders, now)
  return sortDoneOrders(orders)
}
