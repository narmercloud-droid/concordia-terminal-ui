import type { Order } from '../types/order.js'
import type { TranslationKey } from '../i18n/de.js'
import { isPickup } from './orderCountdown.js'

export interface StageAction {
  status: string
  labelKey: TranslationKey
}

export function getStageActions(order: Order): StageAction[] {
  const status = order.status
  const pickup = isPickup(order)

  if (status === 'accepted' || status === 'assigned' || status === 'acknowledged') {
    return [{ status: 'preparing', labelKey: 'actionPreparing' }]
  }
  if (status === 'preparing') {
    if (pickup) {
      return [{ status: 'ready_for_pickup', labelKey: 'actionReadyPickup' }]
    }
    return [{ status: 'out_for_delivery', labelKey: 'actionOnTheWay' }]
  }
  if (status === 'ready_for_pickup' || status === 'ready') {
    return [{ status: 'picked_up', labelKey: 'actionPickedUp' }]
  }
  if (status === 'out_for_delivery' || status === 'courier_assigned') {
    return [{ status: 'delivered', labelKey: 'actionDelivered' }]
  }

  return []
}

export function getCrossTabActions(order: Order): StageAction[] {
  const status = order.status
  const pickup = isPickup(order)
  const actions: StageAction[] = []

  if (['accepted', 'preparing', 'ready_for_pickup', 'ready'].includes(status)) {
    if (!pickup) {
      actions.push({ status: 'out_for_delivery', labelKey: 'actionMoveTransit' })
    }
    actions.push({
      status: pickup ? 'picked_up' : 'delivered',
      labelKey: 'actionMoveDone',
    })
  }
  if (['out_for_delivery', 'courier_assigned'].includes(status)) {
    actions.push({ status: 'preparing', labelKey: 'actionMoveActive' })
    actions.push({ status: 'delivered', labelKey: 'actionMoveDone' })
  }

  return actions
}
