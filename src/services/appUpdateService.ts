import { Capacitor } from '@capacitor/core'
import {
  canInstallPackages,
  downloadAndInstallApk,
  getNativeAppVersion,
  listenAppUpdateProgress,
  openInstallPermissionSettings,
  type AppUpdateProgress,
} from '../native/appUpdate.js'

const MANIFEST_URL =
  'https://raw.githubusercontent.com/narmercloud-droid/concordia-updates/main/latest.json'

const CHECK_COOLDOWN_MS = 30 * 60 * 1000

export type UpdateManifest = {
  versionCode: number
  versionName: string
  apkUrl: string
  checksum?: string
}

export type AppUpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'upToDate'; versionName: string }
  | {
      state: 'available'
      manifest: UpdateManifest
      currentVersionName: string
    }
  | { state: 'needsPermission'; manifest: UpdateManifest }
  | {
      state: 'downloading'
      manifest: UpdateManifest
      percent: number
    }
  | { state: 'installing'; manifest: UpdateManifest }
  | { state: 'error'; message: string }

type Listener = (status: AppUpdateStatus) => void

let status: AppUpdateStatus = { state: 'idle' }
let lastCheckAt = 0
let inFlight: Promise<void> | null = null
const listeners = new Set<Listener>()

function setStatus(next: AppUpdateStatus) {
  status = next
  for (const listener of listeners) listener(status)
}

export function getAppUpdateStatus(): AppUpdateStatus {
  return status
}

export function subscribeAppUpdateStatus(listener: Listener): () => void {
  listeners.add(listener)
  listener(status)
  return () => {
    listeners.delete(listener)
  }
}

async function fetchManifest(): Promise<UpdateManifest> {
  const response = await fetch(MANIFEST_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Update check failed (HTTP ${response.status})`)
  }
  const data = (await response.json()) as Partial<UpdateManifest>
  const versionCode = Number(data.versionCode)
  const versionName = String(data.versionName ?? '')
  const apkUrl = String(data.apkUrl ?? '')
  if (!Number.isFinite(versionCode) || !apkUrl) {
    throw new Error('Invalid update manifest')
  }
  return {
    versionCode,
    versionName,
    apkUrl,
    checksum: data.checksum ? String(data.checksum) : undefined,
  }
}

export async function applyAvailableUpdate(manifest: UpdateManifest): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const allowed = await canInstallPackages()
  if (!allowed) {
    setStatus({ state: 'needsPermission', manifest })
    await openInstallPermissionSettings()
    return
  }

  setStatus({ state: 'downloading', manifest, percent: 0 })
  const stopProgress = listenAppUpdateProgress((event: AppUpdateProgress) => {
    if (event.phase === 'installing') {
      setStatus({ state: 'installing', manifest })
      return
    }
    setStatus({
      state: 'downloading',
      manifest,
      percent: Math.max(0, Math.min(99, Number(event.percent) || 0)),
    })
  })

  try {
    const result = await downloadAndInstallApk({
      url: manifest.apkUrl,
      checksum: manifest.checksum,
    })
    if (result.needsPermission) {
      setStatus({ state: 'needsPermission', manifest })
      await openInstallPermissionSettings()
      return
    }
    setStatus({ state: 'installing', manifest })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    setStatus({ state: 'error', message })
  } finally {
    stopProgress()
  }
}

/**
 * Check GitHub latest.json and auto-download/install when a newer APK is published.
 * Safe to call often — cooldown + single-flight.
 */
export async function checkAndApplyAppUpdate(options?: {
  force?: boolean
  autoApply?: boolean
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (inFlight) return inFlight

  const force = Boolean(options?.force)
  const autoApply = options?.autoApply !== false
  const now = Date.now()
  if (!force && now - lastCheckAt < CHECK_COOLDOWN_MS) return

  inFlight = (async () => {
    setStatus({ state: 'checking' })
    try {
      const [current, manifest] = await Promise.all([
        getNativeAppVersion(),
        fetchManifest(),
      ])
      lastCheckAt = Date.now()
      if (!current) {
        setStatus({ state: 'idle' })
        return
      }
      if (manifest.versionCode <= current.versionCode) {
        setStatus({ state: 'upToDate', versionName: current.versionName })
        return
      }
      setStatus({
        state: 'available',
        manifest,
        currentVersionName: current.versionName,
      })
      if (autoApply) {
        await applyAvailableUpdate(manifest)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus({ state: 'error', message })
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
