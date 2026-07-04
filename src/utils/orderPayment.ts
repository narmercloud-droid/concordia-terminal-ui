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

export function isPaidOrder(order: Pick<Order, 'paymentMethod' | 'paymentStatus'>) {
  return isPaymentSettled(order.paymentStatus)
}
