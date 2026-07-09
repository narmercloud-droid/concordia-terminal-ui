import { useCallback, useRef, useState } from 'react'
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
  const [busy, setBusy] = useState(false)
  const inFlightRef = useRef(false)

  const confirmAndPrint = useCallback(
    async (orderId: string, prepMinutes: number) => {
      if (inFlightRef.current) {
        return { confirmed: null, printOk: false, message: t('confirming') }
      }
      inFlightRef.current = true
      setBusy(true)

      const previous =
        useOrderStore.getState().orders.find((o) => o.order_id === orderId) as
          | OrderDetails
          | undefined

      try {
        void stopPendingAlerts()

        const confirmed = await ordersApi.confirmOrder(orderId, prepMinutes)
        useOrderStore.getState().upsertOrder(confirmed)

        const branchName = useTerminalStore.getState().branch_name
        const receipt = buildOrderReceipt(confirmed, prepMinutes, { branchName })
        const printResult = await printOrderReceipt(receipt)

        return {
          confirmed,
          printOk: printResult.ok,
          message: printResult.ok
            ? t('acceptedPrinted')
            : `${t('printFailed')}: ${printResult.error ?? ''}`,
        }
      } catch (err) {
        if (previous) {
          useOrderStore.getState().upsertOrder(previous)
        }
        console.error('Confirm order failed:', err)
        return {
          confirmed: null,
          printOk: false,
          message: t('confirmError'),
        }
      } finally {
        inFlightRef.current = false
        setBusy(false)
      }
    },
    [t],
  )

  return { confirmAndPrint, busy }
}
