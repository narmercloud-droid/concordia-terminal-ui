import { Capacitor, registerPlugin } from '@capacitor/core'

export type AppUpdateProgress = {
  percent: number
  phase: 'downloading' | 'installing' | string
}

type AppUpdatePlugin = {
  getVersion(): Promise<{ versionCode: number; versionName: string }>
  canInstallPackages(): Promise<{ allowed: boolean }>
  openInstallPermissionSettings(): Promise<void>
  downloadAndInstall(options: {
    url: string
    checksum?: string
  }): Promise<{ needsPermission?: boolean; startedInstall?: boolean }>
  addListener(
    eventName: 'appUpdateProgress',
    listenerFunc: (event: AppUpdateProgress) => void,
  ): Promise<{ remove: () => void }>
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate')

export async function getNativeAppVersion(): Promise<{
  versionCode: number
  versionName: string
} | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    return await AppUpdate.getVersion()
  } catch {
    return null
  }
}

export async function canInstallPackages(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const result = await AppUpdate.canInstallPackages()
    return Boolean(result.allowed)
  } catch {
    return false
  }
}

export async function openInstallPermissionSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await AppUpdate.openInstallPermissionSettings()
  } catch {
    // ignore
  }
}

export async function downloadAndInstallApk(options: {
  url: string
  checksum?: string
}): Promise<{ needsPermission?: boolean; startedInstall?: boolean }> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('App updates require the Android terminal app')
  }
  return AppUpdate.downloadAndInstall(options)
}

export function listenAppUpdateProgress(
  listener: (event: AppUpdateProgress) => void,
): () => void {
  if (!Capacitor.isNativePlatform()) return () => undefined
  let remove: (() => void) | undefined
  void AppUpdate.addListener('appUpdateProgress', listener).then((handle) => {
    remove = () => handle.remove()
  })
  return () => {
    remove?.()
  }
}
