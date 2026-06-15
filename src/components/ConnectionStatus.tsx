import { useEffect, useState } from 'react'
import {
  isOrderRealtimeConnected,
  isOrderRealtimeReconnecting,
  subscribeOrderRealtimeConnection,
} from '../services/orderRealtime.js'
import { useI18n } from '../i18n/index.js'
import '../App.css'

export function ConnectionStatus() {
  const t = useI18n((s) => s.t)
  const [connected, setConnected] = useState(isOrderRealtimeConnected())
  const [reconnecting, setReconnecting] = useState(isOrderRealtimeReconnecting())

  useEffect(() => {
    return subscribeOrderRealtimeConnection(() => {
      setConnected(isOrderRealtimeConnected())
      setReconnecting(isOrderRealtimeReconnecting())
    })
  }, [])

  const statusClass = connected
    ? 'status-online'
    : reconnecting
      ? 'status-reconnecting'
      : 'status-offline'
  const label = connected ? t('live') : reconnecting ? t('reconnecting') : t('offline')

  return (
    <div className={`status-indicator ${statusClass}`} role="status" aria-live="polite">
      <span className="status-dot" aria-hidden />
      <span>{label}</span>
    </div>
  )
}
