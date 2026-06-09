import type { Order, OrderDetails, OrderItem } from '../types/order.js'

function mapModifier(row: any) {
  return {
    name: String(row.name ?? ''),
    price: Number(row.price ?? 0),
  }
}

function mapLine(line: any): OrderItem {
  const name = line.item?.name ?? line.name ?? 'Item'
  const variants = Array.isArray(line.variants)
    ? line.variants.map((v: any) => ({ name: String(v.name ?? ''), value: String(v.name ?? '') }))
    : undefined
  const extras = Array.isArray(line.extras) ? line.extras.map(mapModifier) : undefined
  return {
    id: line.id,
    name,
    quantity: Number(line.quantity ?? 1),
    price: Number(line.price ?? line.item?.price ?? 0),
    notes: line.notes ?? undefined,
    variants,
    extras,
  }
}

export function mapApiOrder(raw: any): Order {
  const id = String(raw.id ?? raw.order_id ?? '')
  return {
    order_id: id,
    subtotal: Number(raw.subtotal ?? raw.orderTotal ?? raw.total ?? 0),
    total: Number(raw.total ?? raw.orderTotal ?? 0),
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    status: raw.status ?? 'pending',
    delivery_type: raw.fulfillmentType ?? raw.delivery_type ?? raw.orderType,
    scheduledFor: raw.scheduledFor ?? raw.scheduled_for ?? undefined,
    paymentMethod: raw.paymentMethod ?? raw.payment_method ?? undefined,
    notes: raw.notes ?? undefined,
    estimated_time:
      raw.estimatedPrepTime != null
        ? `${raw.estimatedPrepTime} min`
        : raw.estimated_time,
    items: Array.isArray(raw.items) ? raw.items.map(mapLine) : [],
    customerName: raw.customerName,
    customerPhone: raw.customerPhone,
    deliveryAddress: raw.deliveryAddress,
  }
}

export function mapApiOrderDetails(raw: any): OrderDetails {
  const base = mapApiOrder(raw)
  return {
    ...base,
    items: Array.isArray(raw.items) ? raw.items.map(mapLine) : [],
  }
}
