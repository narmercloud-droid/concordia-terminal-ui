import { useEffect } from 'react'
import { useOrderStore } from '../store/orderStore.js'
import { isPendingOrder } from '../utils/orderCountdown.js'
import { playUrgentPendingTone, startPendingAlertLoop, stopPendingAlertLoop } from '../utils/notificationSound.js'

export function usePendingAlert() {
  const orders = useOrderStore((state) => state.orders)
  const pendingCount = orders.filter(isPendingOrder).length

  useEffect(() => {
    if (pendingCount > 0) {
      playUrgentPendingTone()
      startPendingAlertLoop(() => useOrderStore.getState().orders.some(isPendingOrder))
    } else {
      stopPendingAlertLoop()
    }
    return () => stopPendingAlertLoop()
  }, [pendingCount])
}
