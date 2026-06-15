import { create } from 'zustand'
import type { Order } from '../types/order.js'
import { ordersApi } from '../api/orders.js'
import { isBerlinToday } from '../utils/berlinToday.js'

function mergeOrders(existing: Order[], fetched: Order[]): Order[] {
  const byId = new Map<string, Order>()

  for (const order of existing) {
    if (isBerlinToday(order.createdAt)) {
      byId.set(order.order_id, order)
    }
  }

  for (const order of fetched) {
    const prev = byId.get(order.order_id)
    byId.set(order.order_id, prev ? { ...prev, ...order } : order)
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

function ordersEqual(a: Order[], b: Order[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (order, index) =>
      order.order_id === b[index]?.order_id && order.status === b[index]?.status,
  )
}

interface OrderState {
  orders: Order[]
  loadOrders: (branchId: string) => Promise<void>
  upsertOrder: (order: Order) => void
  removeOrder: (order_id: string) => void
  clearOrders: () => void
  pendingOrders: () => Order[]
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],

  loadOrders: async (branchId) => {
    if (!branchId) return
    const fetched = (await ordersApi.getOrders(branchId)).filter((o) => isBerlinToday(o.createdAt))
    set((state) => {
      const orders = mergeOrders(state.orders, fetched)
      if (ordersEqual(state.orders, orders)) return state
      return { orders }
    })
  },

  upsertOrder: (order) => {
    if (!isBerlinToday(order.createdAt)) return
    set((state) => {
      const idx = state.orders.findIndex((o) => o.order_id === order.order_id)
      if (idx === -1) return { orders: [order, ...state.orders] }
      const next = [...state.orders]
      next[idx] = { ...next[idx], ...order }
      return { orders: next }
    })
  },

  removeOrder: (order_id) => {
    set((state) => ({
      orders: state.orders.filter((order) => order.order_id !== order_id),
    }))
  },

  clearOrders: () => set({ orders: [] }),

  pendingOrders: () =>
    get().orders.filter((o) => o.status === 'pending' || o.status === 'new'),
}))
