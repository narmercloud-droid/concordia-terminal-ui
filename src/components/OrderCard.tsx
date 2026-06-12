import { memo, useMemo } from 'react'
import type { Order } from '../types/order.js'
import { isPendingOrder, isPickup } from '../utils/orderCountdown.js'
import { CircularTimer } from './CircularTimer.js'
import { useI18n } from '../i18n/index.js'
import { getPrimaryStageAction } from '../utils/orderStages.js'
import { formatOrderDisplayId } from '../utils/orderDisplay.js'

interface OrderCardProps {
  order: Order
  showTimer?: boolean
  onClick: () => void
  onQuickStatus?: () => void
  quickStatusBusy?: boolean
}

function BagHandIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 10V8a4 4 0 1 1 8 0v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M5 10h14l-1.2 10H6.2L5 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 14c.8 1.2 2.2 2 4 2s3.2-.8 4-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export const OrderCard = memo(function OrderCard({
  order,
  showTimer = true,
  onClick,
  onQuickStatus,
  quickStatusBusy,
}: OrderCardProps) {
  const t = useI18n((s) => s.t)
  const pending = isPendingOrder(order)
  const pickup = isPickup(order)
  const primaryAction = useMemo(() => getPrimaryStageAction(order), [order])

  const headline = order.deliveryAddress?.trim() || order.customerName?.trim() || t('guest')
  const displayId = formatOrderDisplayId(order.order_id)

  return (
    <article className={`order-card status-${order.status} ${pending ? 'order-card-pending' : ''}`}>
      {showTimer ? <CircularTimer order={order} /> : <div className="order-timer-spacer" aria-hidden />}

      <button type="button" className="order-card-body" onClick={onClick}>
        <p className="order-card-address">{headline}</p>
        <div className="order-card-meta">
          <span className="order-id">{displayId}</span>
          {pickup ? (
            <span className="order-type-icon order-type-icon--pickup" title={t('pickup')}>
              <BagHandIcon />
            </span>
          ) : null}
          {order.scheduledFor ? (
            <span className="order-badge badge-scheduled">{t('scheduled')}</span>
          ) : null}
        </div>
      </button>

      {primaryAction && onQuickStatus ? (
        <button
          type="button"
          className="order-action-btn"
          disabled={quickStatusBusy}
          aria-label={t(primaryAction.labelKey)}
          onClick={(e) => {
            e.stopPropagation()
            onQuickStatus()
          }}
        >
          {quickStatusBusy ? '…' : <BagHandIcon />}
        </button>
      ) : (
        <div className="order-action-spacer" aria-hidden />
      )}
    </article>
  )
})
