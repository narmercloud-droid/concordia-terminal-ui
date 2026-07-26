import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { openInstallPermissionSettings } from '../native/appUpdate.js'
import {
  applyAvailableUpdate,
  checkAndApplyAppUpdate,
  getAppUpdateStatus,
  subscribeAppUpdateStatus,
  type AppUpdateStatus,
} from '../services/appUpdateService.js'

export function AppUpdateBanner() {
  const t = useI18n((s) => s.t)
  const [status, setStatus] = useState<AppUpdateStatus>(getAppUpdateStatus)

  useEffect(() => subscribeAppUpdateStatus(setStatus), [])

  if (status.state === 'idle' || status.state === 'upToDate' || status.state === 'checking') {
    return null
  }

  if (status.state === 'available') {
    return (
      <div className="app-update-banner" role="status">
        <p>
          {t('updateAvailable', {
            version: status.manifest.versionName,
          })}
        </p>
        <button
          type="button"
          className="button primary"
          onClick={() => void applyAvailableUpdate(status.manifest)}
        >
          {t('updateNow')}
        </button>
      </div>
    )
  }

  if (status.state === 'needsPermission') {
    return (
      <div className="app-update-banner app-update-banner--warn" role="alertdialog">
        <p>{t('updateNeedsPermission')}</p>
        <button
          type="button"
          className="button primary"
          onClick={() => {
            void openInstallPermissionSettings()
            window.setTimeout(() => {
              void checkAndApplyAppUpdate({ force: true, autoApply: true })
            }, 2000)
          }}
        >
          {t('updateAllowInstall')}
        </button>
      </div>
    )
  }

  if (status.state === 'downloading') {
    return (
      <div className="app-update-banner" role="status">
        <p>{t('updateDownloading', { percent: String(status.percent) })}</p>
      </div>
    )
  }

  if (status.state === 'installing') {
    return (
      <div className="app-update-banner" role="status">
        <p>{t('updateInstalling')}</p>
      </div>
    )
  }

  if (status.state === 'error') {
    return (
      <div className="app-update-banner app-update-banner--error" role="alert">
        <p>
          {t('updateFailed')}: {status.message}
        </p>
        <button
          type="button"
          className="button secondary"
          onClick={() => void checkAndApplyAppUpdate({ force: true, autoApply: true })}
        >
          {t('updateRetry')}
        </button>
      </div>
    )
  }

  return null
}
