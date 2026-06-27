import { useEffect, useMemo, useState } from 'react'
import { useOrderStore } from '../store/orderStore.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { ordersApi } from '../api/orders.js'
import { isPendingOrder, isScheduledOrder } from '../utils/orderCountdown.js'
import { playUrgentPendingTone, startPendingAlertLoop, stopPendingAlerts } from '../utils/notificationSound.js'
import { formatCurrency, formatDateTime } from '../utils/format.js'
import { useI18n } from '../i18n/index.js'
import {
  defaultPrepMinutes,
  prepPresetsFor,
  useConfirmAndPrint,
} from '../hooks/useConfirmAndPrint.js'
import type { TranslationKey } from '../i18n/de.js'
import type { OrderDetails } from '../types/order.js'
import { orderShortId } from '../utils/orderDisplay.js'
import { RejectOrderDialog } from './RejectOrderDialog.js'
import { Toast } from './Toast.js'
import '../App.css'

function fulfillmentLabel(type: string | undefined, t: (key: TranslationKey) => string) {
  const value = (type ?? '').toLowerCase()
  if (value.includes('pickup') || value.includes('abhol')) return t('pickup')
  if (value.includes('delivery') || value.includes('liefer')) return t('delivery')
  return type ?? '—'
}

export function IncomingOrderOverlay() {
  const orders = useOrderStore((state) => state.orders)
  const ordersPaused = useTerminalStore((state) => state.ordersPaused)
  const t = useI18n((s) => s.t)
  const { confirmAndPrint, busy } = useConfirmAndPrint()
  const [rejecting, setRejecting] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [details, setDetails] = useState<OrderDetails | null>(null)
  const [prepMinutes, setPrepMinutes] = useState(45)
  const [toastMessage, setToastMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  const pendingOrders = useMemo(
    () =>
      orders
        .filter(isPendingOrder)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders],
  )

  const order = ordersPaused ? undefined : pendingOrders[0]
  const waitingCount = pendingOrders.length - 1

  useEffect(() => {
    if (!order) {
      setDetails(null)
      setLoadError('')
      return
    }

    setPrepMinutes(defaultPrepMinutes(order))
    setLoadError('')

    if ((order.items?.length ?? 0) > 0) {
      setDetails(null)
      return
    }

    setDetails(null)
    let cancelled = false
    ordersApi
      .getOrderDetails(order.order_id)
      .then((full) => {
        if (!cancelled) {
          setDetails(full)
          setPrepMinutes(defaultPrepMinutes(full))
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(t('detailError'))
      })

    return () => {
      cancelled = true
    }
  }, [order?.order_id, order?.items?.length, t])

  useEffect(() => {
    if (!order || ordersPaused) {
      void stopPendingAlerts()
      return
    }

    void playUrgentPendingTone(true)
    startPendingAlertLoop(() => {
      if (
        !useTerminalStore.getState().ordersPaused &&
        useOrderStore.getState().orders.some(isPendingOrder)
      ) {
        void playUrgentPendingTone(true)
      }
    }, 6_000)

    return () => {
      void stopPendingAlerts()
    }
  }, [order?.order_id, ordersPaused])

  if (!order) return null

  const display = details ?? order
  const prepPresets = prepPresetsFor(display)
  const itemLines = (display.items ?? []).map((i) => ({
    key: i.id ?? `${i.name}-${i.quantity}`,
    line: `${i.quantity}× ${i.name}`,
    note: i.notes,
    extras: i.extras ?? [],
  }))

  const submitReject = async (reason: string) => {
    setRejecting(true)
    void stopPendingAlerts()
    try {
      await ordersApi.rejectOrder(order.order_id, reason || undefined)
      useOrderStore.getState().removeOrder(order.order_id)
      setRejectDialogOpen(false)
    } catch (err) {
      console.error(err)
      setToastMessage(t('rejectError'))
    } finally {
      setRejecting(false)
    }
  }

  const handleAcceptAndPrint = async () => {
    setLoadError('')
    void stopPendingAlerts()
    try {
      const result = await confirmAndPrint(order.order_id, prepMinutes)
      setToastMessage(result.message)
      window.setTimeout(() => setToastMessage(''), 4000)
    } catch {
      setLoadError(t('confirmError'))
    }
  }

  return (
    <>
      <div className="incoming-overlay" role="alertdialog" aria-modal="true" aria-labelledby="incoming-title">
        <div className="incoming-panel incoming-panel--expanded">
          {toastMessage ? <Toast visible message={toastMessage} onClose={() => setToastMessage('')} /> : null}

          <p className="incoming-kicker">{t('incomingOrderTitle')}</p>
          {waitingCount > 0 ? (
            <p className="incoming-queue-hint">{t('moreWaiting', { count: String(waitingCount) })}</p>
          ) : null}
          <h2 id="incoming-title" className="incoming-id">
            #{orderShortId(order.order_id)}
          </h2>

          <div className="incoming-meta">
            <span className="incoming-meta-pill">{fulfillmentLabel(display.delivery_type, t)}</span>
            {isScheduledOrder(display) ? (
              <span className="incoming-meta-pill incoming-meta-pill--scheduled">
                {t('scheduledOrder')} · {formatDateTime(display.scheduledFor!)}
              </span>
            ) : null}
            <span className="incoming-meta-pill">{display.customerName ?? t('guest')}</span>
            {display.customerPhone ? <span>{display.customerPhone}</span> : null}
            {display.customerEmail ? <span>{display.customerEmail}</span> : null}
          </div>

          {display.deliveryAddress ? <p className="incoming-address">{display.deliveryAddress}</p> : null}
          {display.notes ? <p className="incoming-note">{t('note')}: {display.notes}</p> : null}

          <ul className="incoming-items incoming-items--scroll">
            {itemLines.map((row) => (
              <li key={row.key}>
                <span>{row.line}</span>
                {row.extras.map((e) => (
                  <span key={e.name} className="incoming-item-extra">+ {e.name}</span>
                ))}
                {row.note ? <span className="incoming-item-extra">» {row.note}</span> : null}
              </li>
            ))}
          </ul>

          <p className="incoming-total">{formatCurrency(display.total)}</p>

          <section className="incoming-prep">
            {isScheduledOrder(display) ? (
              <>
                <h3>{t('scheduledOrder')}</h3>
                <p className="incoming-scheduled-hint">{t('scheduledOrderHint')}</p>
              </>
            ) : (
              <>
                <h3>{t('prepTime')}</h3>
                <div className="prep-presets">
                  {prepPresets.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`prep-chip ${prepMinutes === mins ? 'active' : ''}`}
                      onClick={() => setPrepMinutes(mins)}
                      disabled={busy}
                    >
                      {mins} {t('minutes')}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={prepMinutes}
                  disabled={busy}
                  onChange={(e) => setPrepMinutes(Number(e.target.value))}
                  aria-label={t('prepTime')}
                />
              </>
            )}
          </section>

          {loadError ? <p className="incoming-error">{loadError}</p> : null}

          <div className="incoming-actions">
            <button
              type="button"
              className="button danger incoming-btn"
              onClick={() => setRejectDialogOpen(true)}
              disabled={rejecting || busy}
            >
              {rejecting ? t('rejecting') : t('reject')}
            </button>
            <button
              type="button"
              className="button primary incoming-btn"
              onClick={handleAcceptAndPrint}
              disabled={busy || rejecting}
            >
              {busy ? t('confirming') : t('acceptPrint')}
            </button>
          </div>
        </div>
      </div>

      <RejectOrderDialog
        open={rejectDialogOpen}
        busy={rejecting}
        onClose={() => setRejectDialogOpen(false)}
        onConfirm={submitReject}
      />
    </>
  )
}
