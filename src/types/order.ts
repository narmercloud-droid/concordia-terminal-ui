export type OrderStatus = 'pending' | 'accepted' | 'rejected' | string

export interface OrderItemVariant {
  name: string
  value: string
}

export interface OrderItemModifier {
  name: string
  price: number
}

export interface OrderItem {
  id?: string
  name: string
  quantity: number
  price: number
  notes?: string
  variants?: OrderItemVariant[]
  toppings?: OrderItemModifier[]
  extras?: OrderItemModifier[]
}

export interface Order {
  order_id: string
  subtotal: number
  total: number
  createdAt: string
  status: OrderStatus
  delivery_type?: string
  estimated_time?: string
  estimatedPrepMinutes?: number
  etaReadyAt?: string
  etaDeliveredAt?: string
  confirmedAt?: string
  scheduledFor?: string
  paymentMethod?: string
  notes?: string
  items?: OrderItem[]
  customerName?: string
  customerPhone?: string
  deliveryAddress?: string
}

export interface OrderDetails extends Order {
  items: OrderItem[]
}
