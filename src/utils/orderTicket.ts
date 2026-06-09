import type { OrderDetails } from '../types/order.js'
import { formatCurrency, formatDateTime } from './format.js'

function fulfillmentLabel(type?: string) {
  const t = (type ?? '').toLowerCase()
  if (t.includes('pickup') || t.includes('abhol')) return 'ABHOLUNG'
  return 'LIEFERUNG'
}

function paymentLabel(method?: string) {
  const m = (method ?? 'cash').toLowerCase()
  if (m === 'cod' || m === 'cash') return 'Bar'
  if (m === 'card') return 'Karte'
  if (m === 'paypal') return 'PayPal'
  if (m === 'klarna') return 'Klarna'
  return method ?? 'Bar'
}

export function buildOrderTicket(order: OrderDetails, prepMinutes?: number): string {
  const lines: string[] = [
    'CONCORDIA BESTELLUNG',
    '====================',
    `#${order.order_id.slice(0, 8).toUpperCase()}`,
    formatDateTime(order.createdAt),
    '',
    fulfillmentLabel(order.delivery_type),
    `Zahlung: ${paymentLabel(order.paymentMethod)}`,
  ]

  if (order.scheduledFor) {
    lines.push(`Geplant: ${formatDateTime(order.scheduledFor)}`)
  }
  if (prepMinutes != null) {
    lines.push(`Zubereitungszeit: ${prepMinutes} Min`)
  }

  lines.push('', order.customerName ?? 'Gast', order.customerPhone ?? '')
  if (order.deliveryAddress) {
    lines.push(order.deliveryAddress)
  }
  if (order.notes) {
    lines.push('', `Hinweis: ${order.notes}`)
  }

  lines.push('', '--------------------', 'ARTIKEL')

  for (const item of order.items) {
    lines.push(`${item.quantity}x ${item.name}  ${formatCurrency(item.price)}`)
    for (const variant of item.variants ?? []) {
      lines.push(`  - ${variant.name}`)
    }
    for (const extra of item.extras ?? []) {
      lines.push(`  + ${extra.name} (${formatCurrency(extra.price)})`)
    }
    if (item.notes) {
      lines.push(`  >> ${item.notes}`)
    }
  }

  lines.push(
    '',
    '--------------------',
    `GESAMT: ${formatCurrency(order.total)}`,
    '',
    '====================',
    new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
  )

  return lines.join('\n')
}
