import { registerPlugin } from '@capacitor/core'

export interface SunmiPrintPlugin {
  isAvailable(): Promise<{ available: boolean }>
  printText(options: { text: string }): Promise<{ ok: boolean }>
}

export const SunmiPrint = registerPlugin<SunmiPrintPlugin>('SunmiPrint')

export async function printOnSunmi(text: string): Promise<boolean> {
  try {
    const { available } = await SunmiPrint.isAvailable()
    if (!available) return false
    await SunmiPrint.printText({ text })
    return true
  } catch {
    return false
  }
}
