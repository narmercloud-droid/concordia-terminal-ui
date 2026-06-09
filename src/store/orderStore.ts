import { create } from 'zustand'
import type { Order } from '../types/order.js'
import { ordersApi } from '../api/orders.js'
import { isBerlinToday } from '../utils/berlinToday.js'

interface OrderState {
  orders: Order[]
  loadOrders: (branchId: string) => Promise<void>
  upsertOrder: (order: Order) => void
  removeOrder: (order_id: string) => void
  pendingOrders: () => Order[]
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],

  loadOrders: async (branchId) => {
    if (!branchId) return
    const orders = (await ordersApi.getOrders(branchId)).filter((o) => isBerlinToday(o.createdAt))
    set({ orders })
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

  pendingOrders: () =>
    get().orders.filter((o) => o.status === 'pending' || o.status === 'new'),
}))
