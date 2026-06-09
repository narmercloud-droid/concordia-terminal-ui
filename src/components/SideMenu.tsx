import { NavLink } from 'react-router-dom'
import { useTerminalStore } from '../store/terminalStore.js'
import { useI18n, type Language } from '../i18n/index.js'
import '../App.css'

interface SideMenuProps {
  open: boolean
  onClose: () => void
}

export function SideMenu({ open, onClose }: SideMenuProps) {
  const ordersPaused = useTerminalStore((state) => state.ordersPaused)
  const setOrdersPaused = useTerminalStore((state) => state.setOrdersPaused)
  const language = useI18n((s) => s.language)
  const setLanguage = useI18n((s) => s.setLanguage)
  const t = useI18n((s) => s.t)

  const togglePause = async () => {
    try {
      await setOrdersPaused(!ordersPaused)
    } catch (err) {
      console.error(err)
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

        <button
          type="button"
          className={`button ${ordersPaused ? 'danger' : 'secondary'} side-menu-btn`}
          onClick={togglePause}
        >
          {ordersPaused ? t('resumeOrders') : t('pauseOrders')}
        </button>

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
