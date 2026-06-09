import { useEffect, useState } from 'react'
import { terminalApi } from '../api/terminal.js'

export const StatusIndicator = () => {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const ping = async () => {
      try {
        const isOnline = await terminalApi.ping()
        if (!cancelled) {
          setOnline(isOnline)
        }
      } catch {
        if (!cancelled) {
          setOnline(false)
        }
      }
    }

    ping()
    const interval = window.setInterval(ping, 20_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const statusLabel = online === null ? 'Checking…' : online ? 'Online' : 'Offline'
  const statusClass = online === null ? 'status-unknown' : online ? 'status-online' : 'status-offline'

  return (
    <div className={`status-indicator ${statusClass}`}>
      <span className="status-dot" />
      <span>{statusLabel}</span>
    </div>
  )
}
