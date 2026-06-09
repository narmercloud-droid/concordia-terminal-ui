import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ordersApi } from '../api/orders.js'
import { Loader } from '../components/Loader.js'
import { ErrorMessage } from '../components/ErrorMessage.js'
import { Toast } from '../components/Toast.js'
import type { OrderDetails as OrderDetailsType, OrderItem } from '../types/order.js'
import { formatCurrency, formatDateTime } from '../utils/format.js'
import { buildOrderTicket } from '../utils/orderTicket.js'
import { printOnSunmi } from '../native/sunmiPrint.js'
import '../App.css'

const PREP_PRESETS_DELIVERY = [30, 45, 60, 75]
const PREP_PRESETS_PICKUP = [10, 15, 20, 30]

function defaultPrepMinutes(fulfillment?: string) {
  const type = (fulfillment ?? '').toLowerCase()
  if (type.includes('pickup') || type.includes('abhol')) return 15
  return 45
}

function fulfillmentLabel(type?: string) {
  const t = (type ?? '').toLowerCase()
  if (t.includes('pickup') || t.includes('abhol')) return 'Abholung'
  if (t.includes('delivery') || t.includes('liefer')) return 'Lieferung'
  return type ?? '—'
}

function paymentLabel(method?: string) {
  const m = (method ?? 'cash').toLowerCase()
  if (m === 'cod' || m === 'cash') return 'Bar'
  if (m === 'card') return 'Karte'
  if (m === 'paypal') return 'PayPal'
  if (m === 'klarna') return 'Klarna'
  return method ?? 'Bar'
}

const OrderDetails = () => {
  const { order_id } = useParams<{ order_id: string }>()
  const [order, setOrder] = useState<OrderDetailsType | null>(null)
  const [prepMinutes, setPrepMinutes] = useState(45)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!order_id) {
      setError('Bestellung nicht gefunden')
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
        setError('Bestelldetails konnten nicht geladen werden.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    loadOrder()
  }, [order_id])

  const isPending = order?.status === 'pending' || order?.status === 'new'
  const prepPresets = useMemo(() => {
    const t = (order?.delivery_type ?? '').toLowerCase()
    if (t.includes('pickup') || t.includes('abhol')) return PREP_PRESETS_PICKUP
    return PREP_PRESETS_DELIVERY
  }, [order?.delivery_type])

  const handleConfirm = async () => {
    if (!order_id || !order || !isPending) return
    setConfirming(true)
    setError('')
    try {
      const confirmed = await ordersApi.confirmOrder(order_id, prepMinutes)
      const ticket = buildOrderTicket(confirmed, prepMinutes)
      const printed = await printOnSunmi(ticket)
      setToastMessage(
        printed
          ? 'Bestellung angenommen und gedruckt.'
          : 'Bestellung angenommen. Druck fehlgeschlagen — Küche prüfen.',
      )
      window.setTimeout(() => {
        navigate('/orders', {
          state: {
            toast: printed
              ? 'Bestellung bestätigt und Bon gedruckt.'
              : 'Bestellung bestätigt (Druck fehlgeschlagen).',
          },
        })
      }, 900)
    } catch (err) {
      setError('Bestätigung fehlgeschlagen. Zubereitungszeit 5–180 Min. prüfen.')
      console.error(err)
    } finally {
      setConfirming(false)
    }
  }

  const handleReject = async () => {
    if (!order_id || !isPending) return
    const reason = window.prompt('Ablehnungsgrund (optional):') ?? ''
    setRejecting(true)
    setError('')
    try {
      await ordersApi.rejectOrder(order_id, reason || undefined)
      navigate('/orders', { state: { toast: 'Bestellung abgelehnt.' } })
    } catch (err) {
      setError('Bestellung konnte nicht abgelehnt werden.')
      console.error(err)
    } finally {
      setRejecting(false)
    }
  }

  const handleReprint = async () => {
    if (!order) return
    const ticket = buildOrderTicket(order, order.estimated_time ? Number.parseInt(order.estimated_time, 10) : undefined)
    const printed = await printOnSunmi(ticket)
    setToastMessage(printed ? 'Bon erneut gedruckt.' : 'Druck fehlgeschlagen.')
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
      {item.notes ? <div className="item-note">Hinweis: {item.notes}</div> : null}
    </div>
  )

  return (
    <div className="page-shell terminal-page">
      <div className="panel detail-panel">
        <div className="panel-header">
          <h1>Bestelldetails</h1>
          <p>Artikel prüfen, Zeit wählen, annehmen oder ablehnen.</p>
        </div>

        {loading ? (
          <Loader />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : order ? (
          <>
            {toastMessage && <Toast visible message={toastMessage} onClose={() => setToastMessage('')} />}

            <section className="detail-section">
              <div className="detail-row">
                <span>Bestellung</span>
                <strong>#{order.order_id.slice(0, 8).toUpperCase()}</strong>
              </div>
              <div className="detail-row">
                <span>Eingang</span>
                <strong>{formatDateTime(order.createdAt)}</strong>
              </div>
              {order.scheduledFor ? (
                <div className="detail-row">
                  <span>Geplant für</span>
                  <strong>{formatDateTime(order.scheduledFor)}</strong>
                </div>
              ) : null}
              <div className="detail-row">
                <span>Kunde</span>
                <strong>{order.customerName ?? 'Gast'}</strong>
              </div>
              <div className="detail-row">
                <span>Telefon</span>
                <strong>{order.customerPhone ?? '—'}</strong>
              </div>
              <div className="detail-row">
                <span>Art</span>
                <strong>{fulfillmentLabel(order.delivery_type)}</strong>
              </div>
              <div className="detail-row">
                <span>Zahlung</span>
                <strong>{paymentLabel(order.paymentMethod)}</strong>
              </div>
              {order.deliveryAddress ? (
                <div className="detail-row">
                  <span>Adresse</span>
                  <strong>{order.deliveryAddress}</strong>
                </div>
              ) : null}
              {order.notes ? (
                <div className="detail-row">
                  <span>Hinweis</span>
                  <strong>{order.notes}</strong>
                </div>
              ) : null}
              <div className="detail-row">
                <span>Status</span>
                <strong>{order.status}</strong>
              </div>
            </section>

            <section className="items-section">
              <h2>Artikel</h2>
              {order.items.length === 0 ? (
                <p className="empty-state">Keine Artikel.</p>
              ) : (
                order.items.map(renderItem)
              )}
            </section>

            <section className="summary-section">
              <div className="summary-row">
                <span>Gesamt</span>
                <strong>{formatCurrency(order.total)}</strong>
              </div>
            </section>

            {isPending ? (
              <section className="detail-section">
                <h2>Zubereitungszeit</h2>
                <div className="prep-presets">
                  {prepPresets.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`prep-chip ${prepMinutes === mins ? 'active' : ''}`}
                      onClick={() => setPrepMinutes(mins)}
                    >
                      {mins} Min
                    </button>
                  ))}
                </div>
                <label htmlFor="prep_minutes">Oder manuell (5–180 Min.)</label>
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

            <div className="action-group">
              <button className="button secondary" type="button" onClick={() => navigate('/orders')}>
                Zurück
              </button>
              {!isPending ? (
                <button className="button tertiary" type="button" onClick={handleReprint}>
                  Bon drucken
                </button>
              ) : null}
              {isPending ? (
                <>
                  <button
                    className="button danger"
                    type="button"
                    onClick={handleReject}
                    disabled={rejecting}
                  >
                    {rejecting ? 'Wird abgelehnt…' : 'Ablehnen'}
                  </button>
                  <button
                    className="button primary"
                    type="button"
                    onClick={handleConfirm}
                    disabled={confirming}
                  >
                    {confirming ? 'Wird angenommen…' : 'Annehmen & Drucken'}
                  </button>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <p>Bestellung nicht verfügbar.</p>
        )}
      </div>
    </div>
  )
}

export default OrderDetails
