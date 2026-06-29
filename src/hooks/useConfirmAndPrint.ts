import { useState, useCallback } from 'react'
import { ordersApi } from '../api/orders.js'
import { useOrderStore } from '../store/orderStore.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { buildOrderReceipt, resolveCourierUrl } from '../utils/orderTicket.js'
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

  const confirmAndPrint = useCallback(
    async (orderId: string, prepMinutes: number) => {
      setBusy(true)
      void stopPendingAlerts()
      try {
        const branchName = useTerminalStore.getState().branch_name
        const existing = useOrderStore
          .getState()
          .orders.find((o) => o.order_id === orderId) as OrderDetails | undefined

        let printPromise: ReturnType<typeof printOrderReceipt> | null = null
        if (existing && (existing.items?.length ?? 0) > 0) {
          const earlyReceipt = buildOrderReceipt(existing, prepMinutes, { branchName })
          printPromise = printOrderReceipt(earlyReceipt)
        }

        const confirmed = await ordersApi.confirmOrder(orderId, prepMinutes)
        useOrderStore.getState().upsertOrder(confirmed)

        if (!printPromise) {
          const receipt = buildOrderReceipt(confirmed, prepMinutes, { branchName })
          printPromise = printOrderReceipt(receipt)
        }

        const printResult = await printPromise
        const delivery = !String(confirmed.delivery_type ?? '')
          .toLowerCase()
          .match(/pickup|abhol/)
        if (delivery && !resolveCourierUrl(confirmed)) {
          console.warn('Delivery order missing courier URL/token — QR will not print', orderId)
        }
        if (!printResult.ok) {
          console.warn('Receipt print failed:', printResult.error)
        }
        return {
          confirmed,
          printOk: printResult.ok,
          message: printResult.ok
            ? t('acceptedPrinted')
            : `${t('acceptedNoPrint')} ${printResult.error ?? ''}`.trim(),
        }
      } catch (err) {
        console.error(err)
        throw err
      } finally {
        setBusy(false)
      }
    },
    [t],
  )

  return { confirmAndPrint, busy }
}
