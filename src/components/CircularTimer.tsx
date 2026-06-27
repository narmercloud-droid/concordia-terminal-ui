import { useEffect, useState } from 'react'
import type { Order } from '../types/order.js'
import {
  formatCountdown,
  getCountdownMinutesDisplay,
  getCountdownProgress,
  getRemainingSeconds,
  isPendingOrder,
} from '../utils/orderCountdown.js'
import { useI18n } from '../i18n/index.js'

interface CircularTimerProps {
  order: Order
}

const SIZE = 76
const STROKE = 4
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CircularTimer({ order }: CircularTimerProps) {
  const t = useI18n((s) => s.t)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const pending = isPendingOrder(order)
  const remainingSec = getRemainingSeconds(order, now)
  const countdown = getCountdownMinutesDisplay(order, now)
  const progress = getCountdownProgress(order, now)
  const overdue = countdown?.overdue ?? false
  const showClock =
    countdown?.useClockFormat && remainingSec >= 0 && remainingSec !== -1

  const ringColor = pending ? '#ff8000' : overdue ? '#ef4444' : '#22c55e'
  const offset = CIRCUMFERENCE * (1 - (pending ? 0.25 : progress))

  return (
    <div
      className={`circular-timer ${pending ? 'circular-timer--pending' : ''} ${overdue ? 'circular-timer--overdue' : ''}`}
      aria-hidden
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#e8e8e8"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <div className="circular-timer__label">
        {pending ? (
          <span className="circular-timer__new">{t('newOrder')}</span>
        ) : countdown ? (
          showClock ? (
            <span className="circular-timer__clock">
              {countdown.overdue ? '+' : ''}
              {formatCountdown(remainingSec)}
            </span>
          ) : (
            <>
              <span className="circular-timer__value">
                {countdown.overdue ? `+${countdown.minutes}` : countdown.minutes}
              </span>
              <span className="circular-timer__unit">{t('minutesShort')}</span>
            </>
          )
        ) : (
          <span className="circular-timer__value">—</span>
        )}
      </div>
    </div>
  )
}
