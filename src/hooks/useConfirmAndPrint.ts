import { useCallback } from 'react'
import { ordersApi } from '../api/orders.js'
import { useOrderStore } from '../store/orderStore.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { buildOrderReceipt } from '../utils/orderTicket.js'
import { printOrderReceipt } from '../native/devicePrint.js'
import { stopPendingAlerts } from '../utils/notificationSound.js'
import { isPickup, minutesUntilScheduled } from '../utils/orderCountdown.js'
import type { Order, OrderDetails } from '../types/order.js'
import { useI18n } from '../i18n/index.js'

export function defaultPrepMinutes(order: Pick<Order, 'delivery_type' | 'scheduledFor'>) {
  const scheduledMins = minutesUntilScheduled(order as Order)
  if (scheduledMins != null) return Math.min(180, scheduledMins)

  const type = String(order.delivery_type ?? '').toLowerCase()
  if (type.includes('pickup') || type.includes('abhol')) return 15
  return 45
}

export const PREP_PRESETS_DELIVERY = [30, 45, 60, 75]
export const PREP_PRESETS_PICKUP = [10, 15, 20, 30]

export function prepPresetsFor(order: Pick<Order, 'delivery_type'>) {
  return isPickup(order as Order) ? PREP_PRESETS_PICKUP : PREP_PRESETS_DELIVERY
}

export function useConfirmAndPrint() {
  const t = useI18n((s) => s.t)

  const confirmAndPrint = useCallback(
    (orderId: string, prepMinutes: number) => {
      void stopPendingAlerts()

      const branchName = useTerminalStore.getState().branch_name
      const existing = useOrderStore
        .getState()
        .orders.find((o) => o.order_id === orderId) as OrderDetails | undefined

      if (existing) {
        useOrderStore.getState().upsertOrder({
          ...existing,
          status: 'accepted',
          estimatedPrepMinutes: prepMinutes,
        })

        const receipt = buildOrderReceipt(existing, prepMinutes, { branchName })
        void printOrderReceipt(receipt)
      }

      void ordersApi.confirmOrder(orderId, prepMinutes).then((confirmed) => {
        useOrderStore.getState().upsertOrder(confirmed)
      }).catch((err) => {
        console.error('Confirm API failed (order stays accepted locally):', err)
      })

      return {
        confirmed: existing ? { ...existing, status: 'accepted' as const } : null,
        printOk: true,
        message: t('acceptedPrinted'),
      }
    },
    [t],
  )

  return { confirmAndPrint, busy: false }
}
