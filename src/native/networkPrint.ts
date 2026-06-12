import { registerPlugin } from '@capacitor/core'
import { getNetworkPrinterSettings } from '../lib/printerSettings.js'

export interface NetworkPrintPlugin {
  isAvailable(options: { host: string; port: number }): Promise<{ available: boolean; reason?: string }>
  printText(options: { host: string; port: number; text: string; timeoutMs?: number }): Promise<{ ok: boolean }>
}

const NetworkPrint = registerPlugin<NetworkPrintPlugin>('NetworkPrint')

export async function printOnNetworkPrinter(text: string): Promise<{ ok: boolean; error?: string }> {
  const settings = getNetworkPrinterSettings()
  if (!settings.enabled || !settings.host) {
    return { ok: false, error: 'Network printer not configured' }
  }

  try {
    const check = await NetworkPrint.isAvailable({ host: settings.host, port: settings.port })
    if (!check.available) {
      return { ok: false, error: check.reason ?? 'Network printer not available' }
    }
    await NetworkPrint.printText({
      host: settings.host,
      port: settings.port,
      text,
      timeoutMs: 10_000,
    })
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network print failed'
    return { ok: false, error: message }
  }
}
