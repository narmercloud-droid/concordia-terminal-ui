import { registerPlugin } from '@capacitor/core'

import { SunmiPrint } from './sunmiPrint.js'
import { printOnNetworkPrinter } from './networkPrint.js'
import type { OrderReceipt } from '../utils/orderTicket.js'

export interface DevicePrintPlugin {
  isAvailable(): Promise<{ available: boolean; reason?: string }>
  getDiagnostics?(): Promise<Record<string, unknown>>
  printText(options: { text: string }): Promise<{ ok: boolean }>
  printReceipt?(options: {
    text: string
    qrUrl?: string
    footerText?: string
  }): Promise<{ ok: boolean; qrPrinted?: boolean }>
}

const KingtopPrint = registerPlugin<DevicePrintPlugin>('KingtopPrint')
const ZcsPrint = registerPlugin<DevicePrintPlugin>('ZcsPrint')

async function printReceiptOnPlugin(
  plugin: DevicePrintPlugin,
  receipt: OrderReceipt,
): Promise<{ ok: boolean; qrPrinted: boolean }> {
  const needsQr = Boolean(receipt.qrUrl?.trim())
  if (plugin.printReceipt) {
    const result = await plugin.printReceipt({
      text: receipt.text,
      qrUrl: receipt.qrUrl,
      footerText: receipt.footerText,
    })
    const qrPrinted = needsQr ? result.qrPrinted !== false && result.ok !== false : true
    return { ok: result.ok !== false, qrPrinted }
  }
  await plugin.printText({ text: receipt.text })
  return { ok: true, qrPrinted: !needsQr }
}

async function trySunmiPrint(
  receipt: OrderReceipt,
): Promise<{ ok: boolean; error?: string; driver: string; qrPrinted?: boolean } | null> {
  try {
    const sunmi = await SunmiPrint.isAvailable()
    if (!sunmi.available) return null

    const needsQr = Boolean(receipt.qrUrl?.trim())
    if (SunmiPrint.printReceipt) {
      const printed = await printReceiptOnPlugin(SunmiPrint, receipt)
      if (needsQr && !printed.qrPrinted) {
        return {
          ok: false,
          error: 'Delivery QR did not print',
          driver: 'sunmi',
          qrPrinted: false,
        }
      }
      if (!printed.ok) {
        return { ok: false, error: 'Receipt print failed', driver: 'sunmi', qrPrinted: false }
      }
      return { ok: true, driver: 'sunmi', qrPrinted: printed.qrPrinted }
    }

    await SunmiPrint.printText({ text: receipt.text })
    return { ok: true, driver: 'sunmi', qrPrinted: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sunmi print failed'
    return { ok: false, error: message, driver: 'sunmi' }
  }
}

export async function printOrderReceipt(
  receipt: OrderReceipt,
): Promise<{ ok: boolean; error?: string; driver?: string; qrPrinted?: boolean }> {
  const needsQr = Boolean(receipt.qrUrl?.trim())

  // Sunmi V2/V2S built-in printer — try before network/ZCS/Kingtop paths.
  const sunmiFirst = await trySunmiPrint(receipt)
  if (sunmiFirst?.ok) {
    return sunmiFirst
  }
  let sunmiError = sunmiFirst && !sunmiFirst.ok ? sunmiFirst.error ?? '' : ''

  let zcsReason = ''
  try {
    const zcs = await ZcsPrint.isAvailable()
    if (!zcs.available && zcs.reason) zcsReason = zcs.reason
    if (zcs.available) {
      const printed = await printReceiptOnPlugin(ZcsPrint, receipt)
      if (!printed.ok) {
        console.warn('ZCS receipt body failed, trying Kingtop driver')
      } else {
        if (needsQr && !printed.qrPrinted) {
          return {
            ok: false,
            error: 'Delivery QR did not print',
            driver: 'zcs',
            qrPrinted: false,
          }
        }
        return { ok: true, driver: 'zcs', qrPrinted: printed.qrPrinted }
      }
    }
  } catch (err) {
    zcsReason = err instanceof Error ? err.message : 'ZCS print failed'
    console.warn('ZCS print path failed', err)
  }

  let kingtopReason = ''
  try {
    const kingtop = await KingtopPrint.isAvailable()
    if (!kingtop.available && kingtop.reason) {
      kingtopReason = kingtop.reason
    }
    if (kingtop.available) {
      const printed = await printReceiptOnPlugin(KingtopPrint, receipt)
      if (needsQr && !printed.qrPrinted) {
        return {
          ok: false,
          error: 'Delivery QR did not print',
          driver: 'kingtop',
          qrPrinted: false,
        }
      }
      if (!printed.ok) {
        return { ok: false, error: 'Receipt print failed', driver: 'kingtop', qrPrinted: false }
      }
      return { ok: true, driver: 'kingtop', qrPrinted: printed.qrPrinted }
    }
  } catch (err) {
    kingtopReason = err instanceof Error ? err.message : 'Kingtop print failed'
    console.warn('Kingtop print path failed', err)
  }

  // Sunmi again if the early probe raced service bind (e.g. cold start).
  if (!sunmiFirst?.ok) {
    const sunmiRetry = await trySunmiPrint(receipt)
    if (sunmiRetry?.ok) {
      return sunmiRetry
    }
    if (sunmiRetry && !sunmiRetry.ok) {
      sunmiError = sunmiRetry.error ?? sunmiError
    }
  }

  let networkError = ''
  if (!needsQr) {
    const network = await printOnNetworkPrinter(receipt.text)
    if (network.ok) {
      return { ok: true, driver: 'network', qrPrinted: false }
    }
    networkError = network.error ?? ''
  }

  let detail = 'No supported printer found.'
  if (sunmiError) {
    detail += ` Sunmi: ${sunmiError}.`
  }
  if (zcsReason) {
    detail += ` ZCS: ${zcsReason}.`
  }
  if (kingtopReason) {
    detail += ` Kingtop: ${kingtopReason}.`
  }
  if (networkError) {
    detail += ` Network: ${networkError}.`
  }
  try {
    if (KingtopPrint.getDiagnostics) {
      const diag = await KingtopPrint.getDiagnostics()
      const found = String(diag.handlerClassesFound ?? '')
      if (found === 'none') {
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

export async function printOnDevice(text: string): Promise<{ ok: boolean; error?: string; driver?: string }> {
  return printOrderReceipt({ text })
}

export type PrinterDiagnostics = {
  sunmi: { available: boolean }
  zcs: { driverManagerFound: boolean; available: boolean; lastError: string }
  kingtop: { handlerClassesFound: string; available: boolean; lastError: string; initPath: string }
}

export async function getPrinterDiagnostics(): Promise<PrinterDiagnostics> {
  let sunmiAvailable = false
  try {
    const sunmi = await SunmiPrint.isAvailable()
    sunmiAvailable = sunmi.available
  } catch {
    sunmiAvailable = false
  }

  const zcs = { driverManagerFound: false, available: false, lastError: '' }
  const kingtop = { handlerClassesFound: 'unknown', available: false, lastError: '', initPath: '' }

  try {
    if (ZcsPrint.getDiagnostics) {
      const diag = await ZcsPrint.getDiagnostics()
      zcs.driverManagerFound = Boolean(diag.driverManagerFound)
      zcs.available = Boolean(diag.available)
      zcs.lastError = String(diag.lastError ?? '')
    } else {
      const check = await ZcsPrint.isAvailable()
      zcs.available = check.available
      zcs.lastError = check.reason ?? ''
      zcs.driverManagerFound = check.available
    }
  } catch (err) {
    zcs.lastError = err instanceof Error ? err.message : 'ZCS diagnostics failed'
  }

  try {
    if (KingtopPrint.getDiagnostics) {
      const diag = await KingtopPrint.getDiagnostics()
      kingtop.handlerClassesFound = String(diag.handlerClassesFound ?? 'unknown')
      kingtop.available = Boolean(diag.available)
      kingtop.lastError = String(diag.lastError ?? '')
      kingtop.initPath = String(diag.initPath ?? '')
    }
  } catch (err) {
    kingtop.lastError = err instanceof Error ? err.message : 'Kingtop diagnostics failed'
  }

  return { sunmi: { available: sunmiAvailable }, zcs, kingtop }
}
