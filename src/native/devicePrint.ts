import { registerPlugin } from '@capacitor/core'

import { SunmiPrint } from './sunmiPrint.js'
import { isSunmiPrinterDevice } from './printerPlatform.js'
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

let printChain: Promise<unknown> = Promise.resolve()
let sunmiDevice: boolean | null = null

async function useSunmiDevice(): Promise<boolean> {
  if (sunmiDevice != null) return sunmiDevice
  sunmiDevice = await isSunmiPrinterDevice()
  return sunmiDevice
}

async function withPrintLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = printChain.then(fn, fn)
  printChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

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
): Promise<{ ok: boolean; error?: string; driver: string; qrPrinted?: boolean; attempted: boolean }> {
  try {
    const needsQr = Boolean(receipt.qrUrl?.trim())
    const printed = await printReceiptOnPlugin(SunmiPrint, receipt)
    if (needsQr && !printed.qrPrinted) {
      return {
        ok: false,
        error: 'Delivery QR did not print',
        driver: 'sunmi',
        qrPrinted: false,
        attempted: true,
      }
    }
    if (!printed.ok) {
      return { ok: false, error: 'Receipt print failed', driver: 'sunmi', qrPrinted: false, attempted: true }
    }
    return { ok: true, driver: 'sunmi', qrPrinted: printed.qrPrinted, attempted: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sunmi print failed'
    return { ok: false, error: message, driver: 'sunmi', attempted: true }
  }
}

async function tryKingtopPrint(
  receipt: OrderReceipt,
): Promise<{ ok: boolean; error?: string; driver: string; qrPrinted?: boolean; attempted: boolean } | null> {
  try {
    const kingtop = await KingtopPrint.isAvailable()
    if (!kingtop.available) return null

    const needsQr = Boolean(receipt.qrUrl?.trim())
    const printed = await printReceiptOnPlugin(KingtopPrint, receipt)
    if (needsQr && !printed.qrPrinted) {
      return {
        ok: false,
        error: 'Delivery QR did not print',
        driver: 'kingtop',
        qrPrinted: false,
        attempted: true,
      }
    }
    if (!printed.ok) {
      return { ok: false, error: 'Receipt print failed', driver: 'kingtop', qrPrinted: false, attempted: true }
    }
    return { ok: true, driver: 'kingtop', qrPrinted: printed.qrPrinted, attempted: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kingtop print failed'
    return { ok: false, error: message, driver: 'kingtop', attempted: true }
  }
}

async function printOrderReceiptInner(
  receipt: OrderReceipt,
): Promise<{ ok: boolean; error?: string; driver?: string; qrPrinted?: boolean }> {
  const needsQr = Boolean(receipt.qrUrl?.trim())
  const sunmiFirst = await useSunmiDevice()

  if (sunmiFirst) {
    const sunmi = await trySunmiPrint(receipt)
    return {
      ok: sunmi.ok,
      error: sunmi.error,
      driver: sunmi.driver,
      qrPrinted: sunmi.qrPrinted,
    }
  }

  const kingtop = await tryKingtopPrint(receipt)
  if (kingtop?.attempted && kingtop.ok) {
    return kingtop
  }

  if (!sunmiFirst) {
    const sunmi = await trySunmiPrint(receipt)
    if (sunmi.attempted && sunmi.ok) {
      return sunmi
    }
    if (sunmi.attempted && !sunmi.ok) {
      return sunmi
    }
  }

  let zcsReason = ''
  try {
    const zcs = await ZcsPrint.isAvailable()
    if (!zcs.available && zcs.reason) zcsReason = zcs.reason
    if (zcs.available) {
      const printed = await printReceiptOnPlugin(ZcsPrint, receipt)
      if (printed.ok) {
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

  if (kingtop?.attempted && !kingtop.ok) {
    return kingtop
  }

  let networkError = ''
  if (!needsQr) {
    const network = await printOnNetworkPrinter(receipt.text)
    if (network.ok) {
      return { ok: true, driver: 'network', qrPrinted: false }
    }
    networkError = network.error ?? ''
  }

  let detail = sunmiFirst
    ? 'Sunmi printer failed.'
    : 'No supported printer found.'
  if (kingtop?.error) {
    detail += ` Kingtop: ${kingtop.error}.`
  }
  if (zcsReason) {
    detail += ` ZCS: ${zcsReason}.`
  }
  if (networkError) {
    detail += ` Network: ${networkError}.`
  }

  return { ok: false, error: detail }
}

export async function printOrderReceipt(
  receipt: OrderReceipt,
): Promise<{ ok: boolean; error?: string; driver?: string; qrPrinted?: boolean }> {
  return withPrintLock(() => printOrderReceiptInner(receipt))
}

export async function printOnDevice(text: string): Promise<{ ok: boolean; error?: string; driver?: string }> {
  return printOrderReceipt({ text })
}

export type PrinterDiagnostics = {
  sunmi: { available: boolean }
  zcs: { driverManagerFound: boolean; available: boolean; lastError: string }
  kingtop: { handlerClassesFound: string; available: boolean; lastError: string; initPath: string }
  deviceKind: 'sunmi' | 'other'
}

export async function getPrinterDiagnostics(): Promise<PrinterDiagnostics> {
  const deviceKind = (await isSunmiPrinterDevice()) ? 'sunmi' : 'other'

  let sunmiAvailable = false
  try {
    const sunmi = await SunmiPrint.isAvailable()
    sunmiAvailable = sunmi.available
  } catch {
    sunmiAvailable = false
  }

  const zcs = { driverManagerFound: false, available: false, lastError: '' }
  const kingtop = { handlerClassesFound: 'unknown', available: false, lastError: '', initPath: '' }

  if (deviceKind !== 'sunmi') {
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
  }

  return { sunmi: { available: sunmiAvailable }, zcs, kingtop, deviceKind }
}
