import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrderStore } from '../store/orderStore.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { SideMenu } from './SideMenu.js'
import { ConnectionStatus } from './ConnectionStatus.js'
import { isPendingOrder } from '../utils/orderCountdown.js'
import { useI18n } from '../i18n/index.js'
import '../App.css'

function BellIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export const Header = () => {
  const branch_name = useTerminalStore((state) => state.branch_name)
  const ordersPaused = useTerminalStore((state) => state.ordersPaused)
  const orders = useOrderStore((state) => state.orders)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const t = useI18n((s) => s.t)

  const pendingCount = useMemo(
    () => orders.filter(isPendingOrder).length,
    [orders],
  )

  return (
    <>
      <header className="app-header">
        <button
          type="button"
          className="menu-button"
          aria-label={t('menu')}
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>
        <button
          type="button"
          className="header-brand"
          onClick={() => navigate('/orders')}
        >
          <p className="terminal-name">{branch_name || t('appName')}</p>
        </button>
        <div className="header-actions">
          <ConnectionStatus />
          {ordersPaused ? <span className="header-paused-pill">{t('ordersPausedShort')}</span> : null}
          <button
            type="button"
            className="notification-button"
            aria-label={t('notifications')}
            onClick={() => navigate('/orders')}
          >
            <BellIcon />
            {pendingCount > 0 ? (
              <span className="notification-badge">{pendingCount}</span>
            ) : null}
          </button>
        </div>
      </header>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
