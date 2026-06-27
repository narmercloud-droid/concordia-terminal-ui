import type { OrderDetails, OrderItem } from '../types/order.js'
import { orderShortId } from './orderDisplay.js'

/** 58mm printer ~32 chars at normal size */
const WIDTH = 32

/** Print markers interpreted by ZcsPrintPlugin / ReceiptBitmapRenderer */
const TIGHT = '@@TIGHT@@'
const LARGE = '@@LARGE@@'
const CENTER = '@@CENTER@@'
const BOLD = '@@BOLD@@'
const BOLD_CENTER = '@@BOLD_CENTER@@'

const RULE = '-'.repeat(WIDTH)

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

function centerLarge(text: string): string {
  return `${TIGHT}${CENTER}${LARGE}${text}`
}

function boldCenter(text: string): string {
  return `${BOLD_CENTER}${text}`
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

function isScheduledOrder(order: OrderDetails): boolean {
  if (!order.scheduledFor) return false
  return !Number.isNaN(new Date(order.scheduledFor).getTime())
}

function formatAmount(value: number): string {
  return `${value.toFixed(2)} €`
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

function formatCustomerName(name?: string): string {
  const trimmed = (name ?? '').trim()
  return trimmed || 'Gast'
}

function formatPhone(phone?: string): string | undefined {
  const trimmed = (phone ?? '').trim()
  return trimmed || undefined
}

function formatEmail(email?: string): string | undefined {
  const trimmed = (email ?? '').trim()
  return trimmed || undefined
}

function formatAddressBlock(address?: string): string[] {
  if (!address?.trim()) return []
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return []
  return parts
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

function paymentStatusLine(order: OrderDetails, pickup: boolean, paid: boolean): string {
  if (paid) return boldCenter(`BEZAHLT · ${paymentMethodLabel(order)}`)
  if (pickup) return boldCenter('BAR BEI ABHOLUNG')
  return boldCenter('ZAHLUNG BEI LIEFERUNG')
}

function paymentMethodLabel(order: OrderDetails): string {
  const method = (order.paymentMethod ?? '').toLowerCase()
  if (method === 'card') return 'Karte'
  if (method === 'paypal') return 'PayPal'
  if (method === 'klarna') return 'Klarna'
  if (isPickup(order.delivery_type)) return 'Bar'
  return 'Bar'
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

function appendOrderNotes(lines: string[], notes?: string): void {
  if (!notes) return
  for (const line of notes.split('\n').map((l) => l.trim()).filter(Boolean)) {
    lines.push(`* ${line}`)
  }
}

function itemModifiers(item: OrderItem): OrderItem['extras'] {
  return [...(item.extras ?? []), ...(item.toppings ?? [])]
}

function itemLineTotal(item: OrderItem): number {
  // Backend stores the full unit price in `price` (variant base + extras included).
  // Variants/extras rows are kitchen labels — do not add their prices again.
  return item.quantity * item.price
}

function formatItemBlock(item: OrderItem): string[] {
  const lines: string[] = []
  const num = item.itemNumber ? `#${item.itemNumber} ` : ''
  lines.push(
    `${BOLD}${padLine(`${item.quantity}x ${num}${item.name}`, formatAmount(itemLineTotal(item)))}`,
  )

  for (const variant of item.variants ?? []) {
    const label = variant.value && variant.value !== variant.name ? variant.value : variant.name
    if (label) lines.push(`   * ${label}`)
  }

  for (const mod of itemModifiers(item) ?? []) {
    lines.push(`   * ${mod.name}`)
  }

  if (item.notes) {
    lines.push(`   » ${item.notes}`)
  }

  return lines
}

/** Production customer site — used for driver QR fallback when API omits courierUrl. */
const PRODUCTION_FRONTEND = "https://www.concordiapizza.de"

export function resolveCourierUrl(order: OrderDetails): string | undefined {
  if (order.courierUrl) return order.courierUrl
  if (order.courierToken) {
    return `${PRODUCTION_FRONTEND}/courier/order?token=${order.courierToken}`
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
  const total = order.total > 0 ? order.total : Math.max(0, subtotal - discount) + deliveryFee

  const dueIso = isScheduledOrder(order)
    ? order.scheduledFor!
    : order.scheduledFor ??
      order.etaReadyAt ??
      (prepMinutes != null
        ? new Date(Date.now() + prepMinutes * 60_000).toISOString()
        : order.confirmedAt ?? order.createdAt)

  const due = berlinParts(dueIso)
  const placed = berlinParts(order.createdAt)
  const accepted = berlinParts(order.confirmedAt ?? new Date().toISOString())
  const scheduled = isScheduledOrder(order)

  const lines: string[] = [
    centerLarge(branch),
    centerLarge(pickup ? 'ABHOLUNG' : 'LIEFERUNG'),
  ]

  if (scheduled) {
    lines.push(boldCenter('GEPLANTE BESTELLUNG'))
    lines.push(boldCenter(`Geplant für: ${due.dueDate}, ${due.time}`))
  } else {
    lines.push(boldCenter(`Fällig: ${due.dueDate}, ${due.time}`))
  }

  lines.push(center(formatReceiptOrderId(order.order_id)), RULE)

  for (const item of order.items) {
    lines.push(...formatItemBlock(item))
  }

  lines.push(RULE)

  const grossBeforeDiscount = subtotal + deliveryFee

  if (deliveryFee > 0) {
    lines.push(padLine('Liefergebühr', formatAmount(deliveryFee)))
  }

  lines.push(padLine('Gesamt', formatAmount(grossBeforeDiscount)))

  if (discount > 0 || grossBeforeDiscount > total + 0.009) {
    const shownDiscount = grossBeforeDiscount - total
    if (shownDiscount > 0.009) {
      lines.push(padLine('Rabatt', `-${formatAmount(shownDiscount)}`))
    }
  }

  lines.push(`${BOLD}${padLine('Gesamtbetrag', formatAmount(total))}`)
  lines.push(RULE)
  lines.push(paymentStatusLine(order, pickup, paid))
  lines.push(RULE)
  lines.push(`${BOLD}Kunde: ${formatCustomerName(order.customerName)}`)

  const phone = formatPhone(order.customerPhone)
  if (phone) {
    lines.push(`${BOLD}Tel: ${phone}`)
  }

  const email = formatEmail(order.customerEmail)
  if (email) {
    lines.push(`${BOLD}E-Mail: ${email}`)
  }

  if (pickup) {
    if (customerNotes) {
      lines.push(`${BOLD}Anmerkungen:`)
      appendOrderNotes(lines, customerNotes)
    }
  } else {
    const addressParts = formatAddressBlock(order.deliveryAddress)
    if (addressParts.length) {
      lines.push(`${BOLD}Adresse:`)
      for (const part of addressParts) {
        lines.push(part)
      }
    }
    if (customerNotes) {
      lines.push(`${BOLD}Anmerkungen:`)
      appendOrderNotes(lines, customerNotes)
    }
  }

  lines.push(
    `Aufgegeben: ${placed.stamp}`,
    `Angenommen: ${accepted.stamp}`,
  )

  const qrUrl = !pickup ? resolveCourierUrl(order) : undefined
  const footerText = qrUrl
    ? `${center('Zum Liefern scannen')}\n${center('Lieferschein · keine Rechnung')}`
    : `${center('Lieferschein · keine Rechnung')}`

  return { text: lines.join('\n'), qrUrl, footerText }
}

export function buildOrderTicket(
  order: OrderDetails,
  prepMinutes?: number,
  options?: TicketOptions,
): string {
  return buildOrderReceipt(order, prepMinutes, options).text
}
