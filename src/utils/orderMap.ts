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
    ? line.variants.map((v: any) => ({
        name: String(v.name ?? ''),
        value: String(v.value ?? v.option ?? v.label ?? v.name ?? ''),
        price: v.price != null ? Number(v.price) : undefined,
      }))
    : undefined
  const extras = Array.isArray(line.extras)
    ? line.extras.map(mapModifier)
    : Array.isArray(line.addOns)
      ? line.addOns.map(mapModifier)
      : undefined
  const toppings = Array.isArray(line.toppings) ? line.toppings.map(mapModifier) : undefined

  return {
    id: line.id,
    name,
    quantity: Number(line.quantity ?? 1),
    price: Number(line.price ?? line.item?.basePrice ?? line.item?.price ?? 0),
    itemNumber: line.item?.itemNumber != null ? String(line.item.itemNumber) : undefined,
    kitchen: line.kitchen ?? line.item?.kitchen ?? undefined,
    notes: line.notes ?? undefined,
    variants,
    toppings,
    extras,
  }
}

function lineSubtotal(item: OrderItem): number {
  return item.quantity * item.price
}

function computeSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + lineSubtotal(item), 0)
}

export function mapApiOrder(raw: any): Order {
  const id = String(raw.id ?? raw.order_id ?? '')
  const items = Array.isArray(raw.items) ? raw.items.map(mapLine) : []
  const total = Number(raw.total ?? raw.orderTotal ?? 0)
  const deliveryFee = Number(raw.deliveryFee ?? 0)
  const discount = Number(raw.discount ?? 0)
  const subtotal =
    raw.subtotal != null
      ? Number(raw.subtotal)
      : total + discount - deliveryFee > 0
        ? total + discount - deliveryFee
        : computeSubtotal(items)

  return {
    order_id: id,
    branchId: raw.branchId ?? undefined,
    branchName: raw.branchName ?? raw.branch?.name ?? undefined,
    subtotal,
    total,
    deliveryFee,
    discount,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    status: raw.status ?? 'pending',
    delivery_type: raw.fulfillmentType ?? raw.delivery_type ?? raw.orderType,
    scheduledFor: raw.scheduledFor ?? raw.scheduled_for ?? undefined,
    paymentMethod: raw.paymentMethod ?? raw.payment_method ?? undefined,
    paymentStatus: raw.paymentStatus ?? raw.payment_status ?? undefined,
    notes: raw.notes ?? undefined,
    postalCode: raw.postalCode ?? undefined,
    estimatedPrepMinutes:
      raw.estimatedPrepTime != null ? Number(raw.estimatedPrepTime) : undefined,
    estimatedTotalTime:
      raw.estimatedTotalTime != null ? Number(raw.estimatedTotalTime) : undefined,
    estimated_time:
      raw.estimatedPrepTime != null
        ? `${raw.estimatedPrepTime} min`
        : raw.estimated_time,
    etaReadyAt: raw.etaReadyAt ?? undefined,
    etaDeliveredAt: raw.etaDeliveredAt ?? undefined,
    confirmedAt: raw.confirmedAt ?? undefined,
    items,
    customerName: raw.customerName,
    customerPhone: raw.customerPhone,
    customerEmail: raw.customerEmail ?? undefined,
    deliveryAddress: raw.deliveryAddress,
    courierUrl: raw.courierUrl ?? undefined,
    courierToken: raw.courierToken ?? undefined,
  }
}

export function mapApiOrderDetails(raw: any): OrderDetails {
  const base = mapApiOrder(raw)
  return {
    ...base,
    items: Array.isArray(raw.items) ? raw.items.map(mapLine) : [],
  }
}
