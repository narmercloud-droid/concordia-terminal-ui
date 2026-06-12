export type OrderStatus = 'pending' | 'accepted' | 'rejected' | string

export interface OrderItemVariant {
  name: string
  value: string
  price?: number
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
  itemNumber?: string
  kitchen?: string
  notes?: string
  variants?: OrderItemVariant[]
  toppings?: OrderItemModifier[]
  extras?: OrderItemModifier[]
}

export interface Order {
  order_id: string
  branchId?: string
  branchName?: string
  subtotal: number
  total: number
  deliveryFee?: number
  discount?: number
  createdAt: string
  status: OrderStatus
  delivery_type?: string
  estimated_time?: string
  estimatedPrepMinutes?: number
  estimatedTotalTime?: number
  etaReadyAt?: string
  etaDeliveredAt?: string
  confirmedAt?: string
  scheduledFor?: string
  paymentMethod?: string
  paymentStatus?: string
  notes?: string
  postalCode?: string
  items?: OrderItem[]
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  deliveryAddress?: string
  courierUrl?: string
  courierToken?: string
}

export interface OrderDetails extends Order {
  items: OrderItem[]
}
