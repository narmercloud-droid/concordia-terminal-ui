import { Capacitor, registerPlugin } from '@capacitor/core'

type SunmiPlatformPlugin = {
  getDeviceKind(): Promise<{ kind: 'sunmi' | 'other' }>
  warmUp?(): Promise<{ available: boolean }>
}

const SunmiPlatform = registerPlugin<SunmiPlatformPlugin>('SunmiPrint')

let cachedKind: 'sunmi' | 'other' | null = null

/** True on Sunmi V2/V2s and similar built-in printer devices. */
export async function isSunmiPrinterDevice(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  if (cachedKind) return cachedKind === 'sunmi'

  try {
    const result = await SunmiPlatform.getDeviceKind()
    cachedKind = result.kind === 'sunmi' ? 'sunmi' : 'other'
  } catch {
    cachedKind = 'other'
  }
  return cachedKind === 'sunmi'
}

export function warmSunmiPrinter(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  return (SunmiPlatform.warmUp?.() ?? Promise.resolve({ available: true }))
    .then(() => undefined)
    .catch(() => undefined)
}
