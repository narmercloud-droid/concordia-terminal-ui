import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useOrderStore } from '../store/orderStore.js'
import { useSocket } from '../hooks/useSocket.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { usePendingAlert } from '../hooks/usePendingAlert.js'
import { OrderCard } from '../components/OrderCard.js'
import { Loader } from '../components/Loader.js'
import { Toast } from '../components/Toast.js'
import {
  bucketOrder,
  sortOrdersForTab,
  type OrderTab,
} from '../utils/orderBuckets.js'
import { useI18n } from '../i18n/index.js'
import '../App.css'

const TABS: OrderTab[] = ['active', 'transit', 'done']

const Orders = () => {
  const orders = useOrderStore((state) => state.orders)
  const loadOrders = useOrderStore((state) => state.loadOrders)
  const branch_id = useTerminalStore((state) => state.branch_id)
  const branch_name = useTerminalStore((state) => state.branch_name)
  const ordersPaused = useTerminalStore((state) => state.ordersPaused)
  const t = useI18n((s) => s.t)
  const [activeTab, setActiveTab] = useState<OrderTab>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [now, setNow] = useState(Date.now())
  const navigate = useNavigate()
  const location = useLocation()
  const { connected } = useSocket({ enabled: true })
  usePendingAlert()

  const tabLabels: Record<OrderTab, string> = {
    active: t('tabActive'),
    transit: t('tabTransit'),
    done: t('tabDone'),
  }

  const tabCounts = useMemo(() => {
    const counts: Record<OrderTab, number> = { active: 0, transit: 0, done: 0 }
    for (const order of orders) {
      counts[bucketOrder(order)] += 1
    }
    return counts
  }, [orders])

  const filteredOrders = useMemo(
    () => sortOrdersForTab(
      orders.filter((o) => bucketOrder(o) === activeTab),
      activeTab,
      now,
    ),
    [orders, activeTab, now],
  )

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const toast = (location.state as { toast?: string } | null)?.toast
    if (toast) setToastMessage(toast)
  }, [location.state])

  useEffect(() => {
    if (!branch_id) return
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        await loadOrders(branch_id)
      } catch (err) {
        setError(t('loadError'))
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
    const timer = window.setInterval(load, 30_000)
    return () => window.clearInterval(timer)
  }, [branch_id, loadOrders, t])

  return (
    <div className="page-shell terminal-page">
      <div className="terminal-hero">
        <div>
          <h1>{branch_name || t('orders')}</h1>
          <p className="terminal-subtitle">
            {t('todayOnly')} · {connected ? t('live') : t('reconnecting')}
          </p>
        </div>
        {ordersPaused ? <div className="pause-banner">{t('ordersPaused')}</div> : null}
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
            {tabLabels[tab]}
            <span className="tab-count">{tabCounts[tab]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loader />
      ) : error ? (
        <div className="panel-error">{error}</div>
      ) : filteredOrders.length === 0 ? (
        <p className="empty-state tab-empty">{t('emptyTab', { tab: tabLabels[activeTab] })}</p>
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
