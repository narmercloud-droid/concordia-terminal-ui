import { Capacitor, registerPlugin } from '@capacitor/core'

type SunmiPlatformPlugin = {
  getDeviceKind(): Promise<{ kind: 'sunmi' | 'other' }>
  warmUp?(): Promise<{ available: boolean }>
  isAvailable(): Promise<{ available: boolean }>
}

const SunmiPlatform = registerPlugin<SunmiPlatformPlugin>('SunmiPrint')

let cachedKind: 'sunmi' | 'other' | null = null

/** True on Sunmi V2/V2s and similar built-in printer devices. */
export async function isSunmiPrinterDevice(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  if (cachedKind) return cachedKind === 'sunmi'

  try {
    const result = await SunmiPlatform.getDeviceKind()
    if (result.kind === 'sunmi') {
      cachedKind = 'sunmi'
      return true
    }
  } catch {
    // older builds may lack getDeviceKind — fall through
  }

  try {
    const warm = await (SunmiPlatform.warmUp?.() ?? SunmiPlatform.isAvailable())
    if (warm.available) {
      cachedKind = 'sunmi'
      return true
    }
  } catch {
    // ignore
  }

  cachedKind = 'other'
  return false
}

export function primeSunmiDetection(): void {
  void isSunmiPrinterDevice()
}

export function warmSunmiPrinter(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  return (SunmiPlatform.warmUp?.() ?? SunmiPlatform.isAvailable())
    .then(() => undefined)
    .catch(() => undefined)
}
