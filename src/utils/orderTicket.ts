import type { OrderDetails, OrderItem } from '../types/order.js'
import { orderShortId } from './orderDisplay.js'

/** 58mm printer ~32 chars at normal size */
const WIDTH = 32

/** Print markers interpreted by ZcsPrintPlugin */
const XL = '@@XL@@'
const LARGE = '@@LARGE@@'
const CENTER = '@@CENTER@@'

export type TicketOptions = {
  branchName?: string
}

export type OrderReceipt = {
  text: string
  qrUrl?: string
  footerText?: string
}

function berlinParts(iso?: string): { time: string; dueDate: string; stamp: string } {
  if (!iso) return { time: '—', dueDate: '—', stamp: '—' }
  const d = new Date(iso)
  const time = d.toLocaleTimeString('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = d.toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    day: 'numeric',
    month: 'short',
  })
  const dueDate = parts.replace('.', '').trim()
  return { time, dueDate, stamp: `${time} ${dueDate}` }
}

function center(text: string): string {
  return `${CENTER}${text}`
}

function wrapCenter(text: string): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > WIDTH) {
      if (current) lines.push(center(current))
      current = word.length > WIDTH ? word.slice(0, WIDTH) : word
    } else {
      current = next
    }
  }
  if (current) lines.push(center(current))
  return lines
}

function padLine(left: string, right: string): string {
  const maxLeft = WIDTH - right.length - 1
  const l = left.length > maxLeft ? left.slice(0, Math.max(1, maxLeft - 1)) : left
  const gap = WIDTH - l.length - right.length
  return gap > 0 ? `${l}${' '.repeat(gap)}${right}` : `${l} ${right}`
}

function isPickup(type?: string): boolean {
  const t = (type ?? '').toLowerCase()
  return t.includes('pickup') || t.includes('abhol')
}

function formatAmount(value: number): string {
  return value.toFixed(2)
}

function formatReceiptOrderId(orderId: string): string {
  const code = orderShortId(orderId).slice(0, 6)
  return code.length <= 3 ? `# ${code}` : `# ${code.slice(0, 3)} ${code.slice(3)}`
}

function displayBranchName(name?: string): string {
  const n = (name ?? '').trim()
  if (!n) return 'Pizzeria Concordia'
  if (/kempen/i.test(n)) return 'Pizzeria Concordia'
  if (/straelen/i.test(n)) return 'Pizzeria Concordia II'
  return n
}

function isPaid(order: OrderDetails): boolean {
  const method = (order.paymentMethod ?? '').toLowerCase()
  return (
    order.paymentStatus === 'paid' ||
    method === 'paypal' ||
    method === 'card' ||
    method === 'klarna'
  )
}

function paymentMethodLabel(order: OrderDetails): string {
  const method = (order.paymentMethod ?? '').toLowerCase()
  if (method === 'card') return 'Karte ************'
  if (method === 'paypal') return 'PayPal'
  if (method === 'klarna') return 'Klarna'
  if (isPickup(order.delivery_type)) return 'Bar bei Abholung'
  return 'Bar bei Lieferung'
}

function splitCustomerNotes(notes?: string): string | undefined {
  if (!notes) return undefined
  const lines = notes
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith('[PROMO]') &&
        !l.startsWith('[GUTSCHEIN]') &&
        !l.startsWith('[GRATISGETRÄNK]'),
    )
  return lines.length ? lines.join('\n') : undefined
}

function itemModifiers(item: OrderItem): OrderItem['extras'] {
  return [...(item.extras ?? []), ...(item.toppings ?? [])]
}

function itemLineTotal(item: OrderItem): number {
  const mods = itemModifiers(item) ?? []
  const modTotal = mods.reduce((sum, m) => sum + m.price, 0)
  const variantTotal = (item.variants ?? []).reduce((sum, v) => sum + (v.price ?? 0), 0)
  return item.quantity * (item.price + modTotal + variantTotal)
}

function formatItemBlock(item: OrderItem): string[] {
  const lines: string[] = []
  const num = item.itemNumber ? `#${item.itemNumber} ` : ''
  lines.push(padLine(`${item.quantity} x ${num}${item.name}`, formatAmount(itemLineTotal(item))))

  for (const variant of item.variants ?? []) {
    const label = variant.value && variant.value !== variant.name ? variant.value : variant.name
    if (label) lines.push(`   ${label}`)
  }

  for (const mod of itemModifiers(item) ?? []) {
    lines.push(`   ${mod.name}`)
  }

  if (item.notes) {
    lines.push(`   ${item.notes}`)
  }

  return lines
}

export function resolveCourierUrl(order: OrderDetails): string | undefined {
  if (order.courierUrl) return order.courierUrl
  if (order.courierToken) {
    return `https://concordia-restaurant-de.vercel.app/courier/order?token=${order.courierToken}`
  }
  return undefined
}

export function buildOrderReceipt(
  order: OrderDetails,
  prepMinutes?: number,
  options?: TicketOptions,
): OrderReceipt {
  const branch = displayBranchName(options?.branchName ?? order.branchName)
  const pickup = isPickup(order.delivery_type)
  const paid = isPaid(order)
  const customerNotes = splitCustomerNotes(order.notes)

  const subtotal =
    order.subtotal > 0
      ? order.subtotal
      : order.items.reduce((sum, item) => sum + itemLineTotal(item), 0)
  const deliveryFee = order.deliveryFee ?? 0
  const discount = order.discount ?? 0
  const orderAmount = Math.max(0, subtotal - discount)
  const total = order.total > 0 ? order.total : orderAmount + deliveryFee

  const dueIso =
    order.scheduledFor ??
    order.etaReadyAt ??
    (prepMinutes != null
      ? new Date(Date.now() + prepMinutes * 60_000).toISOString()
      : order.confirmedAt ?? order.createdAt)

  const due = berlinParts(dueIso)
  const placed = berlinParts(order.createdAt)
  const accepted = berlinParts(order.confirmedAt ?? new Date().toISOString())

  const lines: string[] = [
    center(branch),
    `${LARGE}${pickup ? 'ABHOLUNG' : 'LIEFERUNG'}`,
    center(`Fällig: ${due.dueDate}`),
    center('so bald als möglich'),
    `${XL}${due.time}`,
    `${LARGE}${formatReceiptOrderId(order.order_id)}`,
  ]

  for (const item of order.items) {
    lines.push(...formatItemBlock(item))
  }

  lines.push(
    padLine('Zwischensumme', formatAmount(subtotal)),
    padLine('Gesamtbetrag der Bestellung', formatAmount(orderAmount)),
  )

  if (deliveryFee > 0) {
    lines.push(padLine('Liefergebühr', formatAmount(deliveryFee)))
  }

  lines.push(
    padLine('Gesamtbetrag', formatAmount(total)),
    padLine(
      paid ? `Bezahlt von: ${paymentMethodLabel(order)}` : paymentMethodLabel(order),
      formatAmount(total),
    ),
    ...wrapCenter(
      'WICHTIG: FÜR ANGABEN ZU LEBENSMITTELALLERGENEN Rufe das Restaurant an oder überprüfe Sie die Speisekarte.',
    ),
  )

  if (paid) {
    lines.push(`${LARGE}BESTELLUNG IST BEZAHLT`)
  } else if (!pickup) {
    lines.push(`${LARGE}ZAHLUNG BEI LIEFERUNG`)
  }

  lines.push('Details zum/zur Kund:in:', order.customerName ?? 'Gast')

  if (!pickup && order.deliveryAddress) {
    for (const part of order.deliveryAddress.split(',').map((p) => p.trim()).filter(Boolean)) {
      lines.push(part)
    }
  }

  if (customerNotes) {
    lines.push(customerNotes)
  }

  lines.push(
    `Bestellung aufgegeben um: ${placed.stamp}`,
    `Bestellung angenommen um: ${accepted.stamp}`,
  )

  const qrUrl = !pickup ? resolveCourierUrl(order) : undefined
  const footerText = qrUrl
    ? `${center('Zum Liefern scannen')}\n${center('Das ist keine Rechnung')}`
    : `${center('Das ist keine Rechnung')}`

  return { text: lines.join('\n'), qrUrl, footerText }
}

export function buildOrderTicket(
  order: OrderDetails,
  prepMinutes?: number,
  options?: TicketOptions,
): string {
  return buildOrderReceipt(order, prepMinutes, options).text
}
