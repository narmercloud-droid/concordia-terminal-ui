import { Capacitor, registerPlugin } from '@capacitor/core'
import { isSunmiPrinterDevice, warmSunmiPrinter } from './printerPlatform.js'

interface KingtopPrintPlugin {
  isAvailable(): Promise<{ available: boolean }>
  warmUp?(): Promise<{ available: boolean }>
}

const KingtopPrint = registerPlugin<KingtopPrintPlugin>('KingtopPrint')

let warmPromise: Promise<void> | null = null

/** Bind the correct built-in printer SDK once after login. */
export function warmPrinter(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  if (warmPromise) return warmPromise

  warmPromise = isSunmiPrinterDevice().then((sunmi) => {
    if (sunmi) {
      return warmSunmiPrinter()
    }
    return (KingtopPrint.warmUp?.() ?? KingtopPrint.isAvailable())
      .then(() => undefined)
      .catch(() => undefined)
  })

  return warmPromise
}

export function resetPrinterWarmup() {
  warmPromise = null
}
