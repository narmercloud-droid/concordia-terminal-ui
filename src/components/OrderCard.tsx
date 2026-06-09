import { useMemo } from 'react'
import type { Order } from '../types/order.js'
import { formatCurrency, formatDateTime } from '../utils/format.js'
import { isScheduledOrder } from '../utils/orderBuckets.js'

interface OrderCardProps {
  order: Order
  onClick: () => void
}

function fulfillmentBadge(type?: string) {
  const t = (type ?? '').toLowerCase()
  if (t.includes('pickup') || t.includes('abhol')) {
    return { label: 'Abholung', className: 'badge-pickup' }
  }
  return { label: 'Lieferung', className: 'badge-delivery' }
}

export const OrderCard = ({ order, onClick }: OrderCardProps) => {
  const badge = fulfillmentBadge(order.delivery_type)
  const itemPreview = useMemo(() => {
    const names = (order.items ?? []).slice(0, 3).map((i) => `${i.quantity}× ${i.name}`)
    const extra = (order.items?.length ?? 0) > 3 ? `+${(order.items?.length ?? 0) - 3} weitere` : ''
    return [...names, extra].filter(Boolean).join(' · ')
  }, [order.items])

  const scheduled = isScheduledOrder(order)

  return (
    <button type="button" className={`order-card status-${order.status}`} onClick={onClick}>
      <div className="order-card-top">
        <span className="order-id">#{order.order_id.slice(0, 8).toUpperCase()}</span>
        <div className="order-badges">
          {scheduled ? <span className="order-badge badge-scheduled">Geplant</span> : null}
          <span className={`order-badge ${badge.className}`}>{badge.label}</span>
        </div>
      </div>

      <div className="order-card-main">
        <p className="order-customer">{order.customerName ?? 'Gast'}</p>
        {itemPreview ? <p className="order-items-preview">{itemPreview}</p> : null}
        {order.deliveryAddress ? (
          <p className="order-address">{order.deliveryAddress}</p>
        ) : null}
      </div>

      <div className="order-card-footer">
        <span className="order-total">{formatCurrency(order.total)}</span>
        <span className="order-time">
          {order.scheduledFor && scheduled
            ? formatDateTime(order.scheduledFor)
            : formatDateTime(order.createdAt)}
        </span>
      </div>
    </button>
  )
}
