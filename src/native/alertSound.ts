import { Capacitor, registerPlugin } from '@capacitor/core'

interface AlertSoundPlugin {
  playPendingAlert(): Promise<void>
  startPendingAlertLoop(): Promise<void>
  stopPendingAlert(): Promise<void>
}

const AlertSound = registerPlugin<AlertSoundPlugin>('AlertSound')

export async function playNativePendingAlert(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    await AlertSound.playPendingAlert()
    return true
  } catch {
    return false
  }
}

export async function startNativePendingAlertLoop(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    await AlertSound.startPendingAlertLoop()
    return true
  } catch {
    return false
  }
}

export async function stopNativePendingAlert(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await AlertSound.stopPendingAlert()
  } catch {
    // ignore
  }
}
