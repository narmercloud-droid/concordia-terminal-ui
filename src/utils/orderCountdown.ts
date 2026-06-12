import type { Order } from '../types/order.js'



const FINISHED = new Set([

  'delivered',

  'completed',

  'picked_up',

  'rejected',

  'cancelled',

])



export function isPendingOrder(order: Order): boolean {

  return order.status === 'pending' || order.status === 'new'

}



export function isFinishedOrder(order: Order): boolean {

  return FINISHED.has(order.status)

}



export function shouldShowCountdown(order: Order): boolean {

  return !isPendingOrder(order) && !isFinishedOrder(order)

}



export function getOrderDeadlineMs(order: Order, now = Date.now()): number {

  if (order.etaDeliveredAt) {

    const t = new Date(order.etaDeliveredAt).getTime()

    if (!Number.isNaN(t)) return t

  }

  if (order.etaReadyAt) {

    const t = new Date(order.etaReadyAt).getTime()

    if (!Number.isNaN(t)) return t

  }

  if (order.scheduledFor) {

    const t = new Date(order.scheduledFor).getTime()

    if (!Number.isNaN(t) && t > now) return t

  }

  if (order.confirmedAt && order.estimatedPrepMinutes) {

    return new Date(order.confirmedAt).getTime() + order.estimatedPrepMinutes * 60_000

  }

  if (order.createdAt && order.estimatedPrepMinutes) {

    return new Date(order.createdAt).getTime() + order.estimatedPrepMinutes * 60_000

  }

  return Number.MAX_SAFE_INTEGER

}



export function getRemainingSeconds(order: Order, now = Date.now()): number {

  if (isFinishedOrder(order)) return -1

  const deadline = getOrderDeadlineMs(order, now)

  if (deadline === Number.MAX_SAFE_INTEGER) return -1

  return Math.floor((deadline - now) / 1000)

}



export function formatCountdown(totalSeconds: number): string {

  if (totalSeconds < 0) return '—'

  const abs = Math.abs(totalSeconds)

  const h = Math.floor(abs / 3600)

  const m = Math.floor((abs % 3600) / 60)

  const s = abs % 60

  const body = h > 0

    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`

    : `${m}:${String(s).padStart(2, '0')}`

  return totalSeconds < 0 ? `+${body}` : body

}



export function isPickup(order: Order): boolean {

  const t = (order.delivery_type ?? '').toLowerCase()

  return t.includes('pickup') || t.includes('abhol')

}



export function getOrderStartMs(order: Order): number {

  if (order.confirmedAt) {

    const t = new Date(order.confirmedAt).getTime()

    if (!Number.isNaN(t)) return t

  }

  if (order.createdAt) {

    const t = new Date(order.createdAt).getTime()

    if (!Number.isNaN(t)) return t

  }

  return Date.now()

}



export function getElapsedMinutes(order: Order, now = Date.now()): number {

  return Math.max(0, Math.floor((now - getOrderStartMs(order)) / 60_000))

}



export function getPrepProgress(order: Order, now = Date.now()): number {

  const prepMinutes = order.estimatedPrepMinutes ?? 30

  if (prepMinutes <= 0) return 0

  return Math.min(1, getElapsedMinutes(order, now) / prepMinutes)

}



export function getCountdownProgress(order: Order, now = Date.now()): number {

  const remainingSec = getRemainingSeconds(order, now)

  if (remainingSec < 0 && remainingSec !== -1) return 1

  if (remainingSec === -1) return getPrepProgress(order, now)



  const start = getOrderStartMs(order)

  const deadline = getOrderDeadlineMs(order, now)

  if (deadline === Number.MAX_SAFE_INTEGER) return getPrepProgress(order, now)



  const totalSec = Math.max(1, (deadline - start) / 1000)

  return Math.min(1, Math.max(0, 1 - remainingSec / totalSec))

}



export function getCountdownMinutesDisplay(

  order: Order,

  now = Date.now(),

): { minutes: number; overdue: boolean } | null {

  if (isPendingOrder(order) || isFinishedOrder(order)) return null



  const remainingSec = getRemainingSeconds(order, now)

  if (remainingSec === -1) return null



  if (remainingSec >= 0) {

    const minutes = Math.max(0, Math.ceil(remainingSec / 60))

    return { minutes, overdue: false }

  }



  return { minutes: Math.ceil(Math.abs(remainingSec) / 60), overdue: true }

}


