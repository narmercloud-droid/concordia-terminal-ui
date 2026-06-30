import { registerPlugin } from '@capacitor/core'



export interface SunmiPrintPlugin {

  isAvailable(): Promise<{ available: boolean }>

  getDeviceKind?(): Promise<{ kind: 'sunmi' | 'other' }>

  warmUp?(): Promise<{ available: boolean }>

  printText(options: { text: string }): Promise<{ ok: boolean }>

  printReceipt?(options: {
    text: string
    qrUrl?: string
    footerText?: string
  }): Promise<{ ok: boolean; qrPrinted?: boolean }>

}



export const SunmiPrint = registerPlugin<SunmiPrintPlugin>('SunmiPrint')



export async function printOnSunmi(text: string): Promise<{ ok: boolean; error?: string }> {

  try {

    const { available } = await SunmiPrint.isAvailable()

    if (!available) {

      return { ok: false, error: 'Sunmi printer not available' }

    }

    await SunmiPrint.printText({ text })

    return { ok: true }

  } catch (err) {

    const message = err instanceof Error ? err.message : 'Print failed'

    return { ok: false, error: message }

  }

}


