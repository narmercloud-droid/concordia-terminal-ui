import type { Order } from '../types/order.js'

function normalizePaymentMethod(method?: string) {
  const value = (method ?? 'cash').toLowerCase()
  if (value === 'cash' || value === 'cod') return 'COD'
  if (value === 'card' || value === 'apple_pay' || value === 'google_pay') return 'CARD'
  if (value === 'paypal') return 'PAYPAL'
  if (value === 'klarna') return 'KLARNA'
  if (value === 'sepa') return 'SEPA'
  return 'COD'
}

function requiresOnlinePayment(method?: string) {
  return ['CARD', 'PAYPAL', 'KLARNA', 'SEPA'].includes(normalizePaymentMethod(method))
}

function isPaymentSettled(paymentStatus?: string) {
  return (paymentStatus ?? '').toLowerCase() === 'paid'
}

/** Terminal must ignore online orders until payment is captured. */
export function isKitchenVisibleOrder(order: Pick<Order, 'paymentMethod' | 'paymentStatus'>) {
  if (requiresOnlinePayment(order.paymentMethod)) {
    return isPaymentSettled(order.paymentStatus)
  }
  return true
}

/** Failed online payment — display-only Failed tab (not kitchen). */
export function isPaymentIssueOrder(
  order: Pick<Order, 'paymentMethod' | 'paymentStatus' | 'terminalKind' | 'checkoutTag'>,
) {
  if (isKitchenVisibleOrder(order)) return false
  if (order.terminalKind === 'payment_issue') return true
  if (order.checkoutTag === 'payment_failed') return true
  return false
}

export function isPaidOrder(order: Pick<Order, 'paymentMethod' | 'paymentStatus'>) {
  return isPaymentSettled(order.paymentStatus)
}
