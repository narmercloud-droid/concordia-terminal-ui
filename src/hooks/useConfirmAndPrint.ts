import { useState, useCallback } from 'react'
import { ordersApi } from '../api/orders.js'
import { useOrderStore } from '../store/orderStore.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { buildOrderReceipt, resolveCourierUrl } from '../utils/orderTicket.js'
import { printOrderReceipt } from '../native/devicePrint.js'
import { stopPendingAlerts } from '../utils/notificationSound.js'
import { isPickup } from '../utils/orderCountdown.js'
import type { Order } from '../types/order.js'
import { useI18n } from '../i18n/index.js'

export function defaultPrepMinutes(order: Pick<Order, 'delivery_type'>) {
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
        let confirmed = await ordersApi.confirmOrder(orderId, prepMinutes)
        const delivery = !String(confirmed.delivery_type ?? '')
          .toLowerCase()
          .match(/pickup|abhol/)
        if (delivery && !resolveCourierUrl(confirmed)) {
          try {
            confirmed = await ordersApi.getOrderDetails(orderId)
          } catch {
            // use confirm payload as-is
          }
        }
        if (delivery && !resolveCourierUrl(confirmed)) {
          console.warn('Delivery order missing courier URL/token — QR will not print', orderId)
        }
        useOrderStore.getState().upsertOrder(confirmed)
        const branchName = useTerminalStore.getState().branch_name
        const receipt = buildOrderReceipt(confirmed, prepMinutes, { branchName })
        const printResult = await printOrderReceipt(receipt)
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
