import { useEffect, useState } from 'react'

import type { Order } from '../types/order.js'

import { formatCountdown, getRemainingSeconds, isPendingOrder, shouldShowCountdown } from '../utils/orderCountdown.js'

import { useI18n } from '../i18n/index.js'



interface CountdownBadgeProps {

  order: Order

}



export function CountdownBadge({ order }: CountdownBadgeProps) {

  const t = useI18n((s) => s.t)

  const [seconds, setSeconds] = useState(() => getRemainingSeconds(order))



  useEffect(() => {

    if (!shouldShowCountdown(order)) return

    const tick = () => setSeconds(getRemainingSeconds(order))

    tick()

    const id = window.setInterval(tick, 1000)

    return () => window.clearInterval(id)

  }, [order])



  if (isPendingOrder(order)) {

    return <span className="countdown-badge countdown-new">{t('newOrder')}</span>

  }



  if (!shouldShowCountdown(order) || seconds < 0) return null



  const overdue = seconds <= 0

  const label = overdue ? t('overdue') : t('timeLeft')



  return (

    <span className={`countdown-badge ${overdue ? 'countdown-overdue' : 'countdown-ok'}`}>

      {label} {formatCountdown(seconds)}

    </span>

  )

}


