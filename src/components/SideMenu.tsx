import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTerminalStore } from '../store/terminalStore.js'
import { useI18n, type Language } from '../i18n/index.js'
import { getApiErrorMessage } from '../lib/apiErrors.js'
import '../App.css'

interface SideMenuProps {
  open: boolean
  onClose: () => void
}

export function SideMenu({ open, onClose }: SideMenuProps) {
  const branch_id = useTerminalStore((state) => state.branch_id)
  const ordersPaused = useTerminalStore((state) => state.ordersPaused)
  const setOrdersPaused = useTerminalStore((state) => state.setOrdersPaused)
  const loadBranchStatus = useTerminalStore((state) => state.loadBranchStatus)
  const language = useI18n((s) => s.language)
  const setLanguage = useI18n((s) => s.setLanguage)
  const t = useI18n((s) => s.t)
  const [toggling, setToggling] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && branch_id) {
      loadBranchStatus(branch_id).catch(console.error)
    }
  }, [open, branch_id, loadBranchStatus])

  const togglePause = async () => {
    setToggling(true)
    setError('')
    setFeedback('')
    try {
      const nextPaused = !ordersPaused
      await setOrdersPaused(nextPaused)
      setFeedback(nextPaused ? t('ordersPausedConfirm') : t('ordersResumedConfirm'))
      window.setTimeout(() => setFeedback(''), 4000)
    } catch (err) {
      setError(getApiErrorMessage(err) ?? t('pauseToggleFailed'))
    } finally {
      setToggling(false)
    }
  }

  const pickLanguage = (lang: Language) => {
    setLanguage(lang)
  }

  if (!open) return null

  return (
    <div className="side-menu-overlay" onClick={onClose} role="presentation">
      <aside className="side-menu" onClick={(e) => e.stopPropagation()}>
        <h2>{t('menu')}</h2>

        <div className={`pause-status ${ordersPaused ? 'paused' : 'active'}`}>
          <span className="pause-status-dot" />
          <span>{ordersPaused ? t('ordersPausedLabel') : t('ordersActiveLabel')}</span>
        </div>

        <button
          type="button"
          className={`button ${ordersPaused ? 'danger' : 'secondary'} side-menu-btn`}
          onClick={togglePause}
          disabled={toggling}
        >
          {toggling ? '…' : ordersPaused ? t('resumeOrders') : t('pauseOrders')}
        </button>

        {feedback ? <p className="side-menu-feedback success">{feedback}</p> : null}
        {error ? <p className="side-menu-feedback error">{error}</p> : null}

        <NavLink to="/day-report" className="side-menu-link" onClick={onClose}>
          {t('dayReport')}
        </NavLink>

        <section className="side-menu-section">
          <h3>{t('language')}</h3>
          <div className="lang-toggle">
            <button
              type="button"
              className={`lang-chip ${language === 'de' ? 'active' : ''}`}
              onClick={() => pickLanguage('de')}
            >
              {t('german')}
            </button>
            <button
              type="button"
              className={`lang-chip ${language === 'ar' ? 'active' : ''}`}
              onClick={() => pickLanguage('ar')}
            >
              {t('arabic')}
            </button>
          </div>
        </section>

        <button type="button" className="button tertiary side-menu-close" onClick={onClose}>
          {t('back')}
        </button>
      </aside>
    </div>
  )
}
