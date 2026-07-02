import { Capacitor, registerPlugin } from '@capacitor/core'

type SunmiPlatformPlugin = {
  getDeviceKind(): Promise<{ kind: 'sunmi' | 'zcs' | 'other' }>
  warmUp?(): Promise<{ available: boolean }>
  isAvailable(): Promise<{ available: boolean }>
}

const SunmiPlatform = registerPlugin<SunmiPlatformPlugin>('SunmiPrint')

let cachedKind: 'sunmi' | 'zcs' | 'other' | null = null

/** True on Sunmi V2/V2s and similar built-in printer devices. */
export async function isSunmiPrinterDevice(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  const kind = await getPrinterDeviceKind()
  return kind === 'sunmi'
}

/** Kingtop Z91 / ZCS POS — built-in printer via ZCS SDK, not Sunmi. */
export async function isZcsPrinterDevice(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  const kind = await getPrinterDeviceKind()
  return kind === 'zcs'
}

export async function getPrinterDeviceKind(): Promise<'sunmi' | 'zcs' | 'other'> {
  if (!Capacitor.isNativePlatform()) return 'other'
  if (cachedKind) return cachedKind

  try {
    const result = await SunmiPlatform.getDeviceKind()
    if (result.kind === 'sunmi' || result.kind === 'zcs' || result.kind === 'other') {
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
