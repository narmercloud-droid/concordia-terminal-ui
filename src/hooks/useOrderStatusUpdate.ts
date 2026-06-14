import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordersApi } from '../api/orders.js'
import { useOrderStore } from '../store/orderStore.js'
import { bucketOrder } from '../utils/orderBuckets.js'
import type { StageAction } from '../utils/orderStages.js'
import type { TranslationKey } from '../i18n/de.js'
import { useI18n } from '../i18n/index.js'

type UpdateOptions = {
  /** Navigate back to the orders list after update (Lieferando-style). Default true. */
  returnToList?: boolean
  toastKey?: TranslationKey
}

export function useOrderStatusUpdate() {
  const navigate = useNavigate()
  const t = useI18n((s) => s.t)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const updateOrderStatus = useCallback(
    async (orderId: string, status: string, options?: UpdateOptions) => {
      const previous = useOrderStore.getState().orders.find((o) => o.order_id === orderId)
      setUpdatingId(orderId)

      if (previous) {
        useOrderStore.getState().upsertOrder({ ...previous, status })
      }

      try {
        const updated = await ordersApi.updateStatus(orderId, status)
        useOrderStore.getState().upsertOrder(updated)

        if (options?.returnToList !== false) {
          const activeTab = bucketOrder(updated)
          const toast = options?.toastKey ? t(options.toastKey) : t('statusUpdated')
          navigate('/orders', { state: { toast, activeTab }, replace: true })
        }

        return updated
      } catch (err) {
        if (previous) {
          useOrderStore.getState().upsertOrder(previous)
        }
        console.error('[status update failed]', orderId, status, err)
        throw err
      } finally {
        setUpdatingId(null)
      }
    },
    [navigate, t],
  )

  const updateWithAction = useCallback(
    async (orderId: string, action: StageAction, returnToList = true) => {
      return updateOrderStatus(orderId, action.status, {
        returnToList,
        toastKey: action.labelKey,
      })
    },
    [updateOrderStatus],
  )

  return { updateOrderStatus, updateWithAction, updatingId, isUpdating: updatingId != null }
}
