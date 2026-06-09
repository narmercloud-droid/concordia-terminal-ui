import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useOrderStore } from '../store/orderStore.js'
import { useSocket } from '../hooks/useSocket.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { OrderCard } from '../components/OrderCard.js'
import { Loader } from '../components/Loader.js'
import { Toast } from '../components/Toast.js'
import {
  TAB_LABELS,
  bucketOrder,
  type OrderTab,
} from '../utils/orderBuckets.js'
import '../App.css'

const TABS: OrderTab[] = ['new', 'progress', 'ready', 'done', 'scheduled']

const Orders = () => {
  const orders = useOrderStore((state) => state.orders)
  const loadOrders = useOrderStore((state) => state.loadOrders)
  const branch_id = useTerminalStore((state) => state.branch_id)
  const branch_name = useTerminalStore((state) => state.branch_name)
  const ordersPaused = useTerminalStore((state) => state.ordersPaused)
  const [activeTab, setActiveTab] = useState<OrderTab>('new')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { connected } = useSocket({ enabled: true })

  const tabCounts = useMemo(() => {
    const counts: Record<OrderTab, number> = {
      new: 0,
      progress: 0,
      ready: 0,
      done: 0,
      scheduled: 0,
    }
    for (const order of orders) {
      counts[bucketOrder(order)] += 1
    }
    return counts
  }, [orders])

  const filteredOrders = useMemo(
    () => orders.filter((o) => bucketOrder(o) === activeTab),
    [orders, activeTab],
  )

  useEffect(() => {
    const toast = (location.state as { toast?: string } | null)?.toast
    if (toast) {
      setToastMessage(toast)
    }
  }, [location.state])

  useEffect(() => {
    if (!branch_id) return

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        await loadOrders(branch_id)
      } catch (err) {
        setError('Bestellungen konnten nicht geladen werden. WLAN prüfen.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
    const timer = window.setInterval(load, 30_000)
    return () => window.clearInterval(timer)
  }, [branch_id, loadOrders])

  return (
    <div className="page-shell terminal-page">
      <div className="terminal-hero">
        <div>
          <h1>{branch_name || 'Bestellungen'}</h1>
          <p className="terminal-subtitle">
            Nur heutige Bestellungen · {connected ? 'Live aktiv' : 'Verbindung wird wiederhergestellt…'}
          </p>
        </div>
        {ordersPaused ? (
          <div className="pause-banner">Eingehende Bestellungen pausiert</div>
        ) : null}
      </div>

      {toastMessage && <Toast visible message={toastMessage} onClose={() => setToastMessage('')} />}

      <div className="order-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`order-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
            <span className="tab-count">{tabCounts[tab]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <div className="panel-error">{error}</div>
      ) : filteredOrders.length === 0 ? (
        <p className="empty-state tab-empty">Keine Bestellungen in „{TAB_LABELS[activeTab]}“.</p>
      ) : (
        <div className="orders-grid terminal-grid">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.order_id}
              order={order}
              onClick={() => navigate(`/orders/${order.order_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Orders
