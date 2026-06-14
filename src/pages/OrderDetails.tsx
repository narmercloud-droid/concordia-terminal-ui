import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ordersApi } from '../api/orders.js'
import { Loader } from '../components/Loader.js'
import { ErrorMessage } from '../components/ErrorMessage.js'
import { Toast } from '../components/Toast.js'
import { CountdownBadge } from '../components/CountdownBadge.js'
import type { OrderDetails as OrderDetailsType, OrderItem } from '../types/order.js'
import { formatCurrency, formatDateTime } from '../utils/format.js'
import { buildOrderReceipt, resolveCourierUrl } from '../utils/orderTicket.js'
import { printOrderReceipt } from '../native/devicePrint.js'
import { getStageActions } from '../utils/orderStages.js'
import type { StageAction } from '../utils/orderStages.js'
import { getApiErrorMessage } from '../lib/apiErrors.js'
import { isPickup } from '../utils/orderCountdown.js'
import { useI18n } from '../i18n/index.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { useOrderStatusUpdate } from '../hooks/useOrderStatusUpdate.js'
import { getStatusLabelKey, orderShortId } from '../utils/orderDisplay.js'
import '../App.css'

const PREP_PRESETS_DELIVERY = [30, 45, 60, 75]
const PREP_PRESETS_PICKUP = [10, 15, 20, 30]

function defaultPrepMinutes(fulfillment?: string) {
  const type = (fulfillment ?? '').toLowerCase()
  if (type.includes('pickup') || type.includes('abhol')) return 15
  return 45
}

const OrderDetails = () => {
  const { order_id } = useParams<{ order_id: string }>()
  const t = useI18n((s) => s.t)
  const [order, setOrder] = useState<OrderDetailsType | null>(null)
  const [prepMinutes, setPrepMinutes] = useState(45)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const navigate = useNavigate()
  const { updateWithAction, isUpdating } = useOrderStatusUpdate()

  const paymentLabel = (method?: string) => {
    const m = (method ?? 'cash').toLowerCase()
    if (m === 'cod' || m === 'cash') return t('cash')
    if (m === 'card') return t('card')
    if (m === 'paypal') return t('paypal')
    if (m === 'klarna') return t('klarna')
    return method ?? t('cash')
  }

  const fulfillmentLabel = (type?: string) => {
    const value = (type ?? '').toLowerCase()
    if (value.includes('pickup') || value.includes('abhol')) return t('pickup')
    if (value.includes('delivery') || value.includes('liefer')) return t('delivery')
    return type ?? '—'
  }

  useEffect(() => {
    if (!order_id) {
      setError(t('detailError'))
      setLoading(false)
      return
    }

    const loadOrder = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await ordersApi.getOrderDetails(order_id)
        setOrder(response)
        setPrepMinutes(defaultPrepMinutes(response.delivery_type))
      } catch (err) {
        setError(t('detailError'))
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadOrder()
  }, [order_id, t])

  const isPending = order?.status === 'pending' || order?.status === 'new'
  const prepPresets = useMemo(() => {
    if (!order) return PREP_PRESETS_DELIVERY
    return isPickup(order) ? PREP_PRESETS_PICKUP : PREP_PRESETS_DELIVERY
  }, [order])

  const stageActions = order ? getStageActions(order) : []

  const handleConfirm = async () => {
    if (!order_id || !order || !isPending) return
    setConfirming(true)
    setError('')
    try {
      let confirmed = await ordersApi.confirmOrder(order_id, prepMinutes)
      const delivery = !String(confirmed.delivery_type ?? '')
        .toLowerCase()
        .match(/pickup|abhol/)
      if (delivery && !resolveCourierUrl(confirmed)) {
        try {
          confirmed = await ordersApi.getOrderDetails(order_id)
        } catch {
          // use confirm payload as-is
        }
      }
      const branchName = useTerminalStore.getState().branch_name
      const receipt = buildOrderReceipt(confirmed, prepMinutes, { branchName })
      const printResult = await printOrderReceipt(receipt)
      setToastMessage(
        printResult.ok ? t('acceptedPrinted') : `${t('acceptedNoPrint')} ${printResult.error ?? ''}`,
      )
      window.setTimeout(() => {
        navigate('/orders', {
          state: { toast: printResult.ok ? t('acceptedPrinted') : t('acceptedNoPrint') },
        })
      }, 900)
    } catch (err) {
      setError(t('confirmError'))
      console.error(err)
    } finally {
      setConfirming(false)
    }
  }

  const handleReject = async () => {
    if (!order_id || !isPending) return
    const reason = window.prompt(t('rejectPrompt')) ?? ''
    setRejecting(true)
    setError('')
    try {
      await ordersApi.rejectOrder(order_id, reason || undefined)
      navigate('/orders', { state: { toast: t('rejected') } })
    } catch (err) {
      setError(t('rejectError'))
      console.error(err)
    } finally {
      setRejecting(false)
    }
  }

  const handleStatus = async (action: StageAction) => {
    if (!order_id) return
    setError('')
    try {
      await updateWithAction(order_id, action)
    } catch (err) {
      setError(getApiErrorMessage(err) ?? t('statusUpdateFailed'))
      console.error(err)
    }
  }

  const handleReprint = async () => {
    if (!order) return
    const branchName = useTerminalStore.getState().branch_name
    const receipt = buildOrderReceipt(order, order.estimatedPrepMinutes, { branchName })
    const printResult = await printOrderReceipt(receipt)
    setToastMessage(printResult.ok ? t('reprinted') : `${t('printFailed')}: ${printResult.error ?? ''}`)
  }

  const renderItem = (item: OrderItem) => (
    <div key={item.id ?? `${item.name}-${item.quantity}`} className="order-item-card">
      <div className="item-row">
        <span>{item.quantity}× {item.name}</span>
        <span>{formatCurrency(item.price)}</span>
      </div>
      {item.variants?.length ? (
        <div className="item-meta">
          {item.variants.map((v) => (
            <div key={v.name}>· {v.name}</div>
          ))}
        </div>
      ) : null}
      {item.extras?.length ? (
        <div className="item-meta">
          {item.extras.map((e) => (
            <div key={e.name}>+ {e.name} ({formatCurrency(e.price)})</div>
          ))}
        </div>
      ) : null}
      {item.notes ? <div className="item-note">{t('note')}: {item.notes}</div> : null}
    </div>
  )

  return (
    <div className="page-shell terminal-page">
      <div className="panel detail-panel">
        <div className="panel-header">
          <h1>{t('orderDetailTitle')}</h1>
          <p>{t('orderDetailSubtitle')}</p>
        </div>

        {loading ? (
          <Loader />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : order ? (
          <>
            {toastMessage && <Toast visible message={toastMessage} onClose={() => setToastMessage('')} />}

            <div className="detail-countdown-row">
              <CountdownBadge order={order} />
            </div>

            <section className="detail-section">
              <div className="detail-row">
                <span>#</span>
                <strong>#{orderShortId(order.order_id)}</strong>
              </div>
              <div className="detail-row">
                <span>{t('status')}</span>
                <strong>{t(getStatusLabelKey(order.status))}</strong>
              </div>
              <div className="detail-row">
                <span>{t('guest')}</span>
                <strong>{order.customerName ?? t('guest')}</strong>
              </div>
              <div className="detail-row">
                <span>{t('delivery')}</span>
                <strong>{fulfillmentLabel(order.delivery_type)}</strong>
              </div>
              <div className="detail-row">
                <span>{t('payment')}</span>
                <strong>{paymentLabel(order.paymentMethod)}</strong>
              </div>
              {order.scheduledFor ? (
                <div className="detail-row">
                  <span>{t('scheduled')}</span>
                  <strong>{formatDateTime(order.scheduledFor)}</strong>
                </div>
              ) : null}
              {order.deliveryAddress ? (
                <div className="detail-row">
                  <span>{t('address')}</span>
                  <strong>{order.deliveryAddress}</strong>
                </div>
              ) : null}
              {order.notes ? (
                <div className="detail-row">
                  <span>{t('note')}</span>
                  <strong>{order.notes}</strong>
                </div>
              ) : null}
            </section>

            <section className="items-section">
              <h2>{t('items')}</h2>
              {order.items.map(renderItem)}
            </section>

            <section className="summary-section">
              <div className="summary-row">
                <span>{t('total')}</span>
                <strong>{formatCurrency(order.total)}</strong>
              </div>
            </section>

            {isPending ? (
              <section className="detail-section">
                <h2>{t('prepTime')}</h2>
                <div className="prep-presets">
                  {prepPresets.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`prep-chip ${prepMinutes === mins ? 'active' : ''}`}
                      onClick={() => setPrepMinutes(mins)}
                    >
                      {mins} {t('minutes')}
                    </button>
                  ))}
                </div>
                <input
                  id="prep_minutes"
                  type="number"
                  min={5}
                  max={180}
                  value={prepMinutes}
                  onChange={(e) => setPrepMinutes(Number(e.target.value))}
                />
              </section>
            ) : null}

            {!isPending && stageActions.length > 0 ? (
              <section className="detail-section stage-actions">
                {stageActions.map((action) => (
                  <button
                    key={`${action.status}-${action.labelKey}`}
                    type="button"
                    className="button primary stage-action-btn"
                    disabled={isUpdating}
                    onClick={() => handleStatus(action)}
                  >
                    {t(action.labelKey)}
                  </button>
                ))}
              </section>
            ) : null}

            <div className="action-group">
              <button className="button secondary" type="button" onClick={() => navigate('/orders')}>
                {t('back')}
              </button>
              {!isPending ? (
                <button className="button tertiary" type="button" onClick={handleReprint}>
                  {t('reprint')}
                </button>
              ) : null}
              {isPending ? (
                <>
                  <button className="button danger" type="button" onClick={handleReject} disabled={rejecting}>
                    {rejecting ? t('rejecting') : t('reject')}
                  </button>
                  <button className="button primary" type="button" onClick={handleConfirm} disabled={confirming}>
                    {confirming ? t('confirming') : t('acceptPrint')}
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default OrderDetails
