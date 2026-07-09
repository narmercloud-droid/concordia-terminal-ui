import { useState } from 'react'
import { getNetworkPrinterSettings, saveNetworkPrinterSettings, type NetworkPrinterSettings } from '../lib/printerSettings.js'
import { printOnDevice } from '../native/devicePrint.js'
import { useI18n } from '../i18n/index.js'
import '../App.css'

export default function TerminalSettings() {
  const t = useI18n((s) => s.t)
  const [settings, setSettings] = useState<NetworkPrinterSettings>(() => getNetworkPrinterSettings())
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState('')

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
    <div className="page-shell">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h1>{t('terminalSettings')}</h1>
            <p>{t('printerSettingsHint')}</p>
          </div>
        </div>

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
        </div>
      </div>
    </div>
  )
}
