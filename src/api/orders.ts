import { http, unwrapData } from './http.js'
import { mapApiOrder, mapApiOrderDetails } from '../utils/orderMap.js'
import type { Order, OrderDetails } from '../types/order.js'

export const ordersApi = {
  getOrders: async (branchId: string): Promise<Order[]> => {
    const response = await http.get('/api/terminal/orders', {
      params: { branchId },
    })
    const rows = unwrapData<any[]>(response.data) ?? []
    return rows.map(mapApiOrder)
  },

  getOrderDetails: async (order_id: string): Promise<OrderDetails> => {
    const response = await http.get(`/api/terminal/order/${order_id}`)
    return mapApiOrderDetails(unwrapData(response.data))
  },

  confirmOrder: async (order_id: string, prepMinutes: number): Promise<OrderDetails> => {
    const response = await http.post(`/api/terminal/orders/${order_id}/confirm`, {
      prepMinutes,
    })
    return mapApiOrderDetails(unwrapData(response.data))
  },

  rejectOrder: async (order_id: string, reason?: string): Promise<OrderDetails> => {
    const response = await http.post(`/api/terminal/orders/${order_id}/reject`, {
      reason,
    })
    return mapApiOrderDetails(unwrapData(response.data))
  },
}
