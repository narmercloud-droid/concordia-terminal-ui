import type { Socket } from 'socket.io-client'
import { createSocket, disconnectSocket, getSocket } from '../sockets/socket.js'
import { ordersApi } from '../api/orders.js'
import { useOrderStore } from '../store/orderStore.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { mapApiOrder } from '../utils/orderMap.js'
import { isKitchenVisibleOrder, isPaymentIssueOrder } from '../utils/orderPayment.js'
import { isBerlinToday } from '../utils/berlinToday.js'
import { alertNewOrder, startKeepAlive, stopKeepAlive } from '../native/terminalKeepAlive.js'
import { warmPrinter } from '../native/printerWarmup.js'
import { primeSunmiDetection } from '../native/printerPlatform.js'
import { startBackendWarmup, stopBackendWarmup } from '../api/warmup.js'
import { playUrgentPendingTone } from '../utils/notificationSound.js'

const API_URL =
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  'https://api.concordiapizza.de'

let socket: Socket | null = null
let startedForBranch = ''

type Listener = () => void
const connectionListeners = new Set<Listener>()

function notifyConnectionListeners() {
  for (const listener of connectionListeners) {
    listener()
  }
}

export function subscribeOrderRealtimeConnection(listener: Listener): () => void {
  connectionListeners.add(listener)
  listener()
  return () => {
    connectionListeners.delete(listener)
  }
}

export function isOrderRealtimeConnected(): boolean {
  return Boolean(getSocket()?.connected)
}

export function isOrderRealtimeReconnecting(): boolean {
  const activeSocket = getSocket()
  return Boolean(activeSocket && !activeSocket.connected && activeSocket.active)
}

export function startOrderRealtime() {
  const { isAuthenticated, branch_id, branch_name } = useTerminalStore.getState()
  if (!isAuthenticated || !branch_id) {
    stopOrderRealtime()
    return
  }

  if (startedForBranch === branch_id && socket?.connected) {
    void startKeepAlive(branch_id, branch_name || 'Concordia Terminal')
    startBackendWarmup()
    primeSunmiDetection()
    void warmPrinter()
    return
  }

  if (socket) {
    socket.removeAllListeners()
    disconnectSocket()
    socket = null
  }
  startedForBranch = branch_id

  void startKeepAlive(branch_id, branch_name || 'Concordia Terminal')
  startBackendWarmup()
  primeSunmiDetection()
  void warmPrinter()

  try {
    socket = createSocket(API_URL, branch_id)
  } catch (err) {
    console.error('Order realtime init failed:', err)
    startedForBranch = ''
    return
  }

  const onConnect = () => {
    notifyConnectionListeners()
    const branchId = useTerminalStore.getState().branch_id
    if (branchId) {
      void useOrderStore.getState().loadOrders(branchId)
    }
  }
  const onDisconnect = () => notifyConnectionListeners()
  const onReconnectAttempt = () => notifyConnectionListeners()
  const onConnectError = () => notifyConnectionListeners()

  const onNew = (payload: unknown) => {
    const order = mapApiOrder(payload)
    if (!isBerlinToday(order.createdAt)) return
    if (!isKitchenVisibleOrder(order)) return
    order.terminalKind = 'kitchen'
    order.checkoutTag = null
    useOrderStore.getState().upsertOrder(order)
    if ((order.items?.length ?? 0) === 0) {
      void ordersApi.getOrderDetails(order.order_id).then((full) => {
        useOrderStore.getState().upsertOrder({
          ...full,
          terminalKind: 'kitchen',
          checkoutTag: null,
        })
      })
    }
    void warmPrinter()
    if (!useTerminalStore.getState().ordersPaused) {
      const shortId = String(order.order_id || '').replace(/-/g, '').slice(-8).toUpperCase()
      void alertNewOrder(shortId ? `Order #${shortId}` : 'New order')
    }
  }
  const onPaymentIssue = (payload: unknown) => {
    const order = mapApiOrder(payload)
    if (!isBerlinToday(order.createdAt)) return
    if (isKitchenVisibleOrder(order)) return
    order.terminalKind = 'payment_issue'
    order.checkoutTag = order.checkoutTag ?? 'payment_failed'
    const existing = useOrderStore.getState().orders.find((o) => o.order_id === order.order_id)
    const isNewIssue = !existing || !isPaymentIssueOrder(existing)
    useOrderStore.getState().upsertOrder(order)
    if ((order.items?.length ?? 0) === 0) {
      void ordersApi.getOrderDetails(order.order_id).then((full) => {
        if (isKitchenVisibleOrder(full)) return
        useOrderStore.getState().upsertOrder({
          ...full,
          terminalKind: 'payment_issue',
          checkoutTag: full.checkoutTag ?? 'payment_failed',
        })
      })
    }
    if (isNewIssue && !useTerminalStore.getState().ordersPaused) {
      void playUrgentPendingTone(true)
      const shortId = String(order.order_id || '').replace(/-/g, '').slice(-8).toUpperCase()
      void alertNewOrder(shortId ? `Payment failed #${shortId}` : 'Payment failed')
    }
  }
  const onConfirmed = (payload: unknown) => {
    useOrderStore.getState().upsertOrder(mapApiOrder(payload))
  }
  const onUpdate = (payload: unknown) => {
    useOrderStore.getState().upsertOrder(mapApiOrder(payload))
  }
  const onStatus = (payload: {
    orderId?: string
    id?: string
    status?: string
    order?: unknown
  }) => {
    const id = payload?.orderId ?? payload?.id
    if (!id) return
    if (payload.status === 'cancelled' || payload.status === 'rejected') {
      const existing = useOrderStore.getState().orders.find((o) => o.order_id === String(id))
      // Keep payment-failed cards; drop other cancels from the kitchen boards.
      if (existing && isPaymentIssueOrder(existing)) {
        useOrderStore.getState().upsertOrder({ ...existing, status: 'cancelled' })
        return
      }
      useOrderStore.getState().removeOrder(String(id))
      return
    }
    if (payload.order) {
      useOrderStore.getState().upsertOrder(mapApiOrder(payload.order))
      return
    }
    const existing = useOrderStore.getState().orders.find((o) => o.order_id === String(id))
    if (existing && payload.status) {
      useOrderStore.getState().upsertOrder({ ...existing, status: payload.status })
    }
  }
  const onBranchStatus = (payload: { ordersPaused?: boolean }) => {
    if (typeof payload?.ordersPaused === 'boolean') {
      useTerminalStore.setState({ ordersPaused: payload.ordersPaused })
    }
  }

  socket.on('connect', onConnect)
  socket.on('disconnect', onDisconnect)
  socket.on('reconnect_attempt', onReconnectAttempt)
  socket.on('connect_error', onConnectError)
  socket.on('order:new', onNew)
  socket.on('order:payment_issue', onPaymentIssue)
  socket.on('order:confirmed', onConfirmed)
  socket.on('order:rejected', onStatus)
  socket.on('order_update', onUpdate)
  socket.on('order_status', onStatus)
  socket.on('branch:status', onBranchStatus)
  notifyConnectionListeners()
}

export function stopOrderRealtime() {
  if (socket) {
    socket.removeAllListeners()
    disconnectSocket()
    socket = null
  }
  startedForBranch = ''
  notifyConnectionListeners()
  void stopKeepAlive()
  stopBackendWarmup()
}
