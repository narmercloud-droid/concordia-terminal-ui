import { Capacitor } from '@capacitor/core'
import { warmSunmiPrinter } from './printerPlatform.js'

let warmPromise: Promise<void> | null = null

/** Bind the Sunmi built-in printer SDK once after login. */
export function warmPrinter(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  if (warmPromise) return warmPromise

  warmPromise = warmSunmiPrinter().catch(() => undefined)
  return warmPromise
}

export function resetPrinterWarmup() {
  warmPromise = null
}
