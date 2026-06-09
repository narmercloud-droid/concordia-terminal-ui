import { useState } from 'react'
import { useTerminalStore } from '../store/terminalStore.js'
import { StatusIndicator } from './StatusIndicator.js'
import { SideMenu } from './SideMenu.js'
import { useI18n } from '../i18n/index.js'
import '../App.css'

export const Header = () => {
  const branch_name = useTerminalStore((state) => state.branch_name)
  const ordersPaused = useTerminalStore((state) => state.ordersPaused)
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useI18n((s) => s.t)

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
        <div className="header-brand">
          <p className="terminal-name">{branch_name || t('appName')}</p>
        </div>
        <div className="header-actions">
          {ordersPaused ? <span className="header-paused-pill">{t('ordersPausedShort')}</span> : null}
          <StatusIndicator />
        </div>
      </header>
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
