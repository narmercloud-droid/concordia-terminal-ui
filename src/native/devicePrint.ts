import { registerPlugin } from '@capacitor/core'

import { SunmiPrint } from './sunmiPrint.js'



export interface DevicePrintPlugin {

  isAvailable(): Promise<{ available: boolean; reason?: string }>

  getDiagnostics?(): Promise<{ available: boolean; handlerClassesFound: string; lastError: string }>

  printText(options: { text: string }): Promise<{ ok: boolean }>

}



const KingtopPrint = registerPlugin<DevicePrintPlugin>('KingtopPrint')



export async function printOnDevice(text: string): Promise<{ ok: boolean; error?: string; driver?: string }> {

  try {

    const kingtop = await KingtopPrint.isAvailable()

    if (kingtop.available) {

      await KingtopPrint.printText({ text })

      return { ok: true, driver: 'kingtop' }

    }

  } catch (err) {

    const message = err instanceof Error ? err.message : 'Kingtop print failed'

    return { ok: false, error: message, driver: 'kingtop' }

  }



  try {

    const sunmi = await SunmiPrint.isAvailable()

    if (sunmi.available) {

      await SunmiPrint.printText({ text })

      return { ok: true, driver: 'sunmi' }

    }

  } catch (err) {

    const message = err instanceof Error ? err.message : 'Sunmi print failed'

    return { ok: false, error: message, driver: 'sunmi' }

  }



  let detail = 'No supported built-in printer found (Kingtop Z91 or Sunmi).'
  try {
    if (KingtopPrint.getDiagnostics) {
      const diag = await KingtopPrint.getDiagnostics()
      if (diag.handlerClassesFound === 'none') {
        detail += ' Imagpay SDK not detected on device.'
      } else if (diag.lastError) {
        detail += ` ${diag.lastError}`
      }
    }
  } catch {
    // ignore diagnostics failures
  }

  return { ok: false, error: detail }

}


