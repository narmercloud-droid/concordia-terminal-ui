import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useOrderStore } from '../store/orderStore.js'
import { ordersApi } from '../api/orders.js'
import { isPendingOrder } from '../utils/orderCountdown.js'
import { playUrgentPendingTone, startPendingAlertLoop, stopPendingAlertLoop } from '../utils/notificationSound.js'
import { formatCurrency } from '../utils/format.js'
import { useI18n } from '../i18n/index.js'
import '../App.css'

export function IncomingOrderOverlay() {
  const orders = useOrderStore((state) => state.orders)
  const t = useI18n((s) => s.t)
  const navigate = useNavigate()
  const location = useLocation()
  const [rejecting, setRejecting] = useState(false)

  const pendingOrders = useMemo(
    () =>
      orders
        .filter(isPendingOrder)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders],
  )

  const order = pendingOrders[0]
  const onDetailPage = order && location.pathname === `/orders/${order.order_id}`

  useEffect(() => {
    if (!order || onDetailPage) {
      stopPendingAlertLoop()
      return
    }

    playUrgentPendingTone()
    startPendingAlertLoop(() => {
      if (useOrderStore.getState().orders.some(isPendingOrder)) {
        playUrgentPendingTone()
      }
    }, 6000)

    return () => stopPendingAlertLoop()
  }, [order?.order_id, onDetailPage])

  if (!order || onDetailPage) return null

  const itemLines = (order.items ?? []).slice(0, 6).map((i) => `${i.quantity}× ${i.name}`)

  const handleAccept = () => {
    navigate(`/orders/${order.order_id}`)
  }

  const handleReject = async () => {
    const reason = window.prompt(t('rejectPrompt')) ?? ''
    setRejecting(true)
    try {
      await ordersApi.rejectOrder(order.order_id, reason || undefined)
    } catch (err) {
      console.error(err)
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="incoming-overlay" role="alertdialog" aria-modal="true">
      <div className="incoming-panel">
        <p className="incoming-kicker">{t('incomingOrderTitle')}</p>
        <h2 className="incoming-id">#{order.order_id.slice(0, 8).toUpperCase()}</h2>
        <p className="incoming-customer">{order.customerName ?? t('guest')}</p>
        {order.deliveryAddress ? <p className="incoming-address">{order.deliveryAddress}</p> : null}
        <ul className="incoming-items">
          {itemLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="incoming-total">{formatCurrency(order.total)}</p>
        <div className="incoming-actions">
          <button
            type="button"
            className="button danger incoming-btn"
            onClick={handleReject}
            disabled={rejecting}
          >
            {rejecting ? t('rejecting') : t('reject')}
          </button>
          <button type="button" className="button primary incoming-btn" onClick={handleAccept}>
            {t('acceptPrint')}
          </button>
        </div>
      </div>
    </div>
  )
}
