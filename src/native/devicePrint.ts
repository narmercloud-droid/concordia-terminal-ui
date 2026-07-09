import { SunmiPrint } from './sunmiPrint.js'
import { isSunmiPrinterDevice } from './printerPlatform.js'
import { printOnNetworkPrinter } from './networkPrint.js'
import type { OrderReceipt } from '../utils/orderTicket.js'

let printChain: Promise<unknown> = Promise.resolve()

async function withPrintLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = printChain.then(fn, fn)
  printChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function trySunmiPrint(
  receipt: OrderReceipt,
): Promise<{ ok: boolean; error?: string; driver: string; qrPrinted?: boolean }> {
  try {
    const needsQr = Boolean(receipt.qrUrl?.trim())
    if (SunmiPrint.printReceipt) {
      const result = await SunmiPrint.printReceipt({
        text: receipt.text,
        qrUrl: receipt.qrUrl,
        footerText: receipt.footerText,
      })
      const qrPrinted = needsQr ? result.qrPrinted !== false && result.ok !== false : true
      if (needsQr && !qrPrinted) {
        return { ok: false, error: 'Delivery QR did not print', driver: 'sunmi', qrPrinted: false }
      }
      if (!result.ok) {
        return { ok: false, error: 'Receipt print failed', driver: 'sunmi', qrPrinted: false }
      }
      return { ok: true, driver: 'sunmi', qrPrinted }
    }

    await SunmiPrint.printText({ text: receipt.text })
    return { ok: true, driver: 'sunmi', qrPrinted: !needsQr }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sunmi print failed'
    return { ok: false, error: message, driver: 'sunmi' }
  }
}

async function printOrderReceiptInner(
  receipt: OrderReceipt,
): Promise<{ ok: boolean; error?: string; driver?: string; qrPrinted?: boolean }> {
  const needsQr = Boolean(receipt.qrUrl?.trim())
  const sunmiDevice = await isSunmiPrinterDevice()

  if (sunmiDevice) {
    const sunmi = await trySunmiPrint(receipt)
    if (sunmi.ok || sunmi.error) {
      return sunmi
    }
  }

  if (!needsQr) {
    const network = await printOnNetworkPrinter(receipt.text)
    if (network.ok) {
      return { ok: true, driver: 'network', qrPrinted: false }
    }
    if (network.error) {
      return { ok: false, error: network.error, driver: 'network' }
    }
  }

  return {
    ok: false,
    error: sunmiDevice
      ? 'Sunmi printer not available. Check paper and restart the device.'
      : 'This app requires a Sunmi terminal with a built-in printer.',
  }
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

  return { sunmi: { available: sunmiAvailable }, deviceKind }
}
