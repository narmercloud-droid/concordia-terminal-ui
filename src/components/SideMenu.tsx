import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTerminalStore } from '../store/terminalStore.js'
import { useI18n, type Language } from '../i18n/index.js'
import { getApiErrorMessage } from '../lib/apiErrors.js'
import {
  getNetworkPrinterSettings,
  saveNetworkPrinterSettings,
  type NetworkPrinterSettings,
} from '../lib/printerSettings.js'
import { getPrinterDiagnostics, printOnDevice } from '../native/devicePrint.js'
import '../App.css'

function PrinterSettingsForm() {
  const t = useI18n((s) => s.t)
  const [settings, setSettings] = useState<NetworkPrinterSettings>(() => getNetworkPrinterSettings())
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [diag, setDiag] = useState('')

  useEffect(() => {
    getPrinterDiagnostics().then((d) => {
      const z = d.zcs
      const k = d.kingtop
      setDiag(
        `ZCS (Z91): ${z.driverManagerFound ? 'DriverManager found' : 'not found'}\n` +
          `${z.available ? 'ZCS printer OK' : z.lastError || 'ZCS not ready'}\n` +
          `Imagpay: ${k.handlerClassesFound}\n` +
          `${k.available ? `OK (${k.initPath})` : k.lastError || 'not used'}`,
      )
    })
  }, [])

  const save = () => {
    saveNetworkPrinterSettings(settings)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  const testPrint = async () => {
    saveNetworkPrinterSettings(settings)
    setTestResult(t('printerTesting'))
    const result = await printOnDevice('CONCORDIA TESTDRUCK\n\nDrucker OK.\n')
    setTestResult(result.ok ? t('printerTestOk') : `${t('printerTestFail')}: ${result.error ?? ''}`)
  }

  return (
    <div className="printer-settings-form">
      <label className="printer-settings-row">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
        />
        <span>{t('printerNetworkEnabled')}</span>
      </label>
      <label className="printer-settings-field">
        <span>{t('printerIp')}</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="192.168.1.100"
          value={settings.host}
          onChange={(e) => setSettings((s) => ({ ...s, host: e.target.value.trim() }))}
        />
      </label>
      <label className="printer-settings-field">
        <span>{t('printerPort')}</span>
        <input
          type="number"
          min={1}
          max={65535}
          value={settings.port}
          onChange={(e) => setSettings((s) => ({ ...s, port: Number(e.target.value) || 9100 }))}
        />
      </label>
      <button type="button" className="button secondary side-menu-btn" onClick={save}>
        {saved ? t('printerSaved') : t('printerSave')}
      </button>
      <button type="button" className="button tertiary side-menu-btn" onClick={testPrint}>
        {t('printerTest')}
      </button>
      {testResult ? <p className="side-menu-feedback">{testResult}</p> : null}
      {diag ? <pre className="printer-diag">{diag}</pre> : null}
    </div>
  )
}

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
          <h3>{t('printerSettings')}</h3>
          <p className="side-menu-hint">{t('printerSettingsHint')}</p>
          <PrinterSettingsForm />
        </section>

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
