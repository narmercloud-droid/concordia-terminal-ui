import { useEffect, useState } from 'react'
import { createSocket, disconnectSocket, getSocket } from '../sockets/socket.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { useOrderStore } from '../store/orderStore.js'
import { mapApiOrder } from '../utils/orderMap.js'
import { playUrgentPendingTone } from '../utils/notificationSound.js'
import { isBerlinToday } from '../utils/berlinToday.js'

const API_URL =
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  'https://concordia-backend-web.onrender.com'

type Options = { enabled?: boolean }

export const useSocket = ({ enabled = false }: Options = {}) => {
  const branch_id = useTerminalStore((state) => state.branch_id)
  const isAuthenticated = useTerminalStore((state) => state.isAuthenticated)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled || !isAuthenticated || !branch_id) {
      disconnectSocket()
      setConnected(false)
      return
    }

    let socket
    try {
      socket = createSocket(API_URL, branch_id)
    } catch (err) {
      console.error('Socket init failed:', err)
      return
    }

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    const onNew = (payload: unknown) => {
      const order = mapApiOrder(payload)
      if (!isBerlinToday(order.createdAt)) return
      const existing = useOrderStore.getState().orders.some((o) => o.order_id === order.order_id)
      if (!existing && (order.status === 'pending' || order.status === 'new')) {
        playUrgentPendingTone()
      }
      useOrderStore.getState().upsertOrder(order)
    }
    const onConfirmed = (payload: unknown) => useOrderStore.getState().upsertOrder(mapApiOrder(payload))
    const onUpdate = (payload: unknown) => useOrderStore.getState().upsertOrder(mapApiOrder(payload))
    const onStatus = (payload: any) => {
      const id = payload?.orderId ?? payload?.id
      if (!id) return
      if (payload.status === 'cancelled' || payload.status === 'rejected') {
        useOrderStore.getState().removeOrder(String(id))
        return
      }
      if (payload.order) {
        useOrderStore.getState().upsertOrder(mapApiOrder(payload.order))
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('order:new', onNew)
    socket.on('order:confirmed', onConfirmed)
    socket.on('order_update', onUpdate)
    socket.on('order_status', onStatus)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('order:new', onNew)
      socket.off('order:confirmed', onConfirmed)
      socket.off('order_update', onUpdate)
      socket.off('order_status', onStatus)
      disconnectSocket()
    }
  }, [enabled, isAuthenticated, branch_id])

  return { connected, socket: getSocket() }
}
