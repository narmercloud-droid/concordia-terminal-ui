import { memo, useMemo } from 'react'
import type { Order } from '../types/order.js'
import { formatCurrency } from '../utils/format.js'
import { isPendingOrder } from '../utils/orderCountdown.js'
import { CountdownBadge } from './CountdownBadge.js'
import { useI18n } from '../i18n/index.js'

interface OrderCardProps {
  order: Order
  onClick: () => void
}

export const OrderCard = memo(function OrderCard({ order, onClick }: OrderCardProps) {
  const t = useI18n((s) => s.t)
  const pending = isPendingOrder(order)

  const fulfillmentLabel = useMemo(() => {
    const type = (order.delivery_type ?? '').toLowerCase()
    if (type.includes('pickup') || type.includes('abhol')) return t('pickup')
    return t('delivery')
  }, [order.delivery_type, t])

  const badgeClass = fulfillmentLabel === t('pickup') ? 'badge-pickup' : 'badge-delivery'

  const itemPreview = useMemo(() => {
    const names = (order.items ?? []).slice(0, 3).map((i) => `${i.quantity}× ${i.name}`)
    const extra = (order.items?.length ?? 0) > 3 ? `+${(order.items?.length ?? 0) - 3}` : ''
    return [...names, extra].filter(Boolean).join(' · ')
  }, [order.items])

  return (
    <button
      type="button"
      className={`order-card status-${order.status} ${pending ? 'order-card-pending' : ''}`}
      onClick={onClick}
    >
      <div className="order-card-top">
        <span className="order-id">#{order.order_id.slice(0, 8).toUpperCase()}</span>
        <div className="order-badges">
          <CountdownBadge order={order} />
          {order.scheduledFor ? (
            <span className="order-badge badge-scheduled">{t('scheduled')}</span>
          ) : null}
          <span className={`order-badge ${badgeClass}`}>{fulfillmentLabel}</span>
        </div>
      </div>

      <div className="order-card-main">
        <p className="order-customer">{order.customerName ?? t('guest')}</p>
        {itemPreview ? <p className="order-items-preview">{itemPreview}</p> : null}
        {order.deliveryAddress ? (
          <p className="order-address">{order.deliveryAddress}</p>
        ) : null}
      </div>

      <div className="order-card-footer">
        <span className="order-total">{formatCurrency(order.total)}</span>
      </div>
    </button>
  )
})
