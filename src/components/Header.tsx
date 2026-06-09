import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTerminalStore } from '../store/terminalStore.js'
import { StatusIndicator } from './StatusIndicator.js'
import '../App.css'

export const Header = () => {
  const branch_name = useTerminalStore((state) => state.branch_name)
  const terminal_code = useTerminalStore((state) => state.terminal_code)
  const branch_id = useTerminalStore((state) => state.branch_id)
  const ordersPaused = useTerminalStore((state) => state.ordersPaused)
  const loadBranchStatus = useTerminalStore((state) => state.loadBranchStatus)
  const setOrdersPaused = useTerminalStore((state) => state.setOrdersPaused)
  const logout = useTerminalStore((state) => state.logout)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (branch_id) {
      loadBranchStatus(branch_id).catch(console.error)
    }
  }, [branch_id, loadBranchStatus])

  const handlePauseToggle = async () => {
    setToggling(true)
    try {
      await setOrdersPaused(!ordersPaused)
    } catch (err) {
      console.error(err)
    } finally {
      setToggling(false)
    }
  }

  return (
    <header className="app-header">
      <div>
        <p className="terminal-name">{branch_name || 'Concordia Terminal'}</p>
        <p className="terminal-meta">Code: {terminal_code || '—'}</p>
      </div>
      <nav className="header-nav">
        <NavLink to="/orders" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Bestellungen
        </NavLink>
        <NavLink to="/day-report" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          Tagesabschluss
        </NavLink>
      </nav>
      <div className="header-actions">
        <button
          className={`button ${ordersPaused ? 'danger' : 'secondary'} pause-toggle`}
          type="button"
          onClick={handlePauseToggle}
          disabled={toggling}
        >
          {toggling ? '…' : ordersPaused ? 'Bestellungen fortsetzen' : 'Bestellungen pausieren'}
        </button>
        <StatusIndicator />
        <button className="button tertiary" type="button" onClick={logout}>
          Trennen
        </button>
      </div>
    </header>
  )
}
