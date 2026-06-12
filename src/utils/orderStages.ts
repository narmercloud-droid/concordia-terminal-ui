import type { Order } from '../types/order.js'
import type { TranslationKey } from '../i18n/de.js'
import { isPickup } from './orderCountdown.js'

export interface StageAction {
  status: string
  labelKey: TranslationKey
}

const DONE = new Set(['delivered', 'completed', 'picked_up', 'rejected', 'cancelled'])
const TRANSIT = new Set(['out_for_delivery', 'courier_assigned'])

export function getPrimaryStageAction(order: Order): StageAction | null {
  const actions = getStageActions(order)
  return actions[0] ?? null
}

export function getStageActions(order: Order): StageAction[] {
  const status = order.status
  const pickup = isPickup(order)
  if (DONE.has(status) || status === 'pending' || status === 'new') return []

  const actions: StageAction[] = []

  if (status === 'accepted' || status === 'assigned' || status === 'acknowledged') {
    actions.push({ status: 'preparing', labelKey: 'actionPreparing' })
  }

  if (!pickup && !TRANSIT.has(status) && !DONE.has(status)) {
    actions.push({ status: 'out_for_delivery', labelKey: 'actionOnTheWay' })
  }

  if (pickup && (status === 'preparing' || status === 'ready_for_pickup' || status === 'ready')) {
    actions.push({ status: 'ready_for_pickup', labelKey: 'actionReadyPickup' })
    actions.push({ status: 'picked_up', labelKey: 'actionPickedUp' })
  }

  if (TRANSIT.has(status)) {
    actions.push({ status: 'delivered', labelKey: 'actionDelivered' })
  }

  if (!pickup && !DONE.has(status) && status !== 'out_for_delivery' && status !== 'courier_assigned') {
    actions.push({ status: 'delivered', labelKey: 'actionDelivered' })
  }

  return dedupeActions(actions)
}

export function getCrossTabActions(_order: Order): StageAction[] {
  return []
}

function dedupeActions(actions: StageAction[]): StageAction[] {
  const seen = new Set<string>()
  return actions.filter((action) => {
    if (seen.has(action.status)) return false
    seen.add(action.status)
    return true
  })
}
