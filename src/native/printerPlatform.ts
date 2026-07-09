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
  const kind = await getPrinterDeviceKind()
  return kind === 'sunmi'
}

export async function getPrinterDeviceKind(): Promise<'sunmi' | 'other'> {
  if (!Capacitor.isNativePlatform()) return 'other'
  if (cachedKind) return cachedKind

  try {
    const result = await SunmiPlatform.getDeviceKind()
    if (result.kind === 'sunmi' || result.kind === 'other') {
      cachedKind = result.kind
      return result.kind
    }
  } catch {
    // older builds may lack getDeviceKind — fall through
  }

  cachedKind = 'other'
  return 'other'
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
