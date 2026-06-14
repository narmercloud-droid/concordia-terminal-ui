import { useEffect } from 'react'
import { useOrderStore } from '../store/orderStore.js'
import { isPendingOrder } from '../utils/orderCountdown.js'
import { playUrgentPendingTone, startPendingAlertLoop, stopPendingAlerts } from '../utils/notificationSound.js'

export function usePendingAlert() {
  const orders = useOrderStore((state) => state.orders)
  const pendingCount = orders.filter(isPendingOrder).length

  useEffect(() => {
    if (pendingCount > 0) {
      void playUrgentPendingTone()
      startPendingAlertLoop(() => {
        if (useOrderStore.getState().orders.some(isPendingOrder)) {
          void playUrgentPendingTone()
        }
      })
    } else {
      void stopPendingAlerts()
    }
    return () => {
      void stopPendingAlerts()
    }
  }, [pendingCount])
}
