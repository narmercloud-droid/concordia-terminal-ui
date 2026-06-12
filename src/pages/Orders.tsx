import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useOrderStore } from '../store/orderStore.js'
import { useSocket } from '../hooks/useSocket.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { OrderCard } from '../components/OrderCard.js'
import { Loader } from '../components/Loader.js'
import { Toast } from '../components/Toast.js'
import {
  bucketOrder,
  sortOrdersForTab,
  type OrderTab,
} from '../utils/orderBuckets.js'
import { getPrimaryStageAction } from '../utils/orderStages.js'
import { useOrderStatusUpdate } from '../hooks/useOrderStatusUpdate.js'
import { getApiErrorMessage } from '../lib/apiErrors.js'
import { useI18n } from '../i18n/index.js'
import type { Order } from '../types/order.js'
import '../App.css'

const TABS: OrderTab[] = ['active', 'transit', 'done']

const Orders = () => {
  const orders = useOrderStore((state) => state.orders)
  const loadOrders = useOrderStore((state) => state.loadOrders)
  const branch_id = useTerminalStore((state) => state.branch_id)
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
  const { updateWithAction, updatingId } = useOrderStatusUpdate()

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
    const state = location.state as { toast?: string; activeTab?: OrderTab } | null
    if (state?.toast) setToastMessage(state.toast)
    if (state?.activeTab) setActiveTab(state.activeTab)
    if (state?.toast || state?.activeTab) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state, location.pathname, navigate])

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
    const timer = window.setInterval(load, connected ? 300_000 : 90_000)
    return () => window.clearInterval(timer)
  }, [branch_id, loadOrders, t, connected])

  const handleQuickStatus = async (order: Order) => {
    const action = getPrimaryStageAction(order)
    if (!action) return
    setError('')
    try {
      const updated = await updateWithAction(order.order_id, action, false)
      if (updated) {
        setToastMessage(t(action.labelKey))
        setActiveTab(bucketOrder(updated))
      }
    } catch (err) {
      setError(getApiErrorMessage(err) ?? t('statusUpdateFailed'))
      console.error(err)
    }
  }

  return (
    <div className="page-shell terminal-page">
      {ordersPaused ? <div className="pause-banner">{t('ordersPaused')}</div> : null}

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
            {tabCounts[tab] > 0 ? ` (${tabCounts[tab]})` : ''}
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
        <div className="orders-list">
          {filteredOrders.map((order) => (
            <OrderCard
              key={order.order_id}
              order={order}
              showTimer={activeTab !== 'done'}
              onClick={() => navigate(`/orders/${order.order_id}`)}
              onQuickStatus={() => handleQuickStatus(order)}
              quickStatusBusy={updatingId === order.order_id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Orders
