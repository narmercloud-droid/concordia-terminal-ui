import { Capacitor, registerPlugin } from '@capacitor/core'

interface KingtopPrintPlugin {
  isAvailable(): Promise<{ available: boolean }>
}

const KingtopPrint = registerPlugin<KingtopPrintPlugin>('KingtopPrint')

let warmPromise: Promise<void> | null = null

/** Initialize Kingtop SDK once after login so the first receipt prints faster. */
export function warmPrinter(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  if (warmPromise) return warmPromise

  warmPromise = KingtopPrint.isAvailable()
    .then(() => undefined)
    .catch(() => undefined)

  return warmPromise
}

export function resetPrinterWarmup() {
  warmPromise = null
}
