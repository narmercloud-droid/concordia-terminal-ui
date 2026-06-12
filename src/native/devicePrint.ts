import { registerPlugin } from '@capacitor/core'

import { SunmiPrint } from './sunmiPrint.js'
import { printOnNetworkPrinter } from './networkPrint.js'
import type { OrderReceipt } from '../utils/orderTicket.js'

export interface DevicePrintPlugin {
  isAvailable(): Promise<{ available: boolean; reason?: string }>
  getDiagnostics?(): Promise<Record<string, unknown>>
  printText(options: { text: string }): Promise<{ ok: boolean }>
  printReceipt?(options: { text: string; qrUrl?: string; footerText?: string }): Promise<{ ok: boolean }>
}

const KingtopPrint = registerPlugin<DevicePrintPlugin>('KingtopPrint')
const ZcsPrint = registerPlugin<DevicePrintPlugin>('ZcsPrint')

async function printReceiptOnPlugin(
  plugin: DevicePrintPlugin,
  receipt: OrderReceipt,
): Promise<boolean> {
  if (plugin.printReceipt) {
    await plugin.printReceipt({
      text: receipt.text,
      qrUrl: receipt.qrUrl,
      footerText: receipt.footerText,
    })
    return true
  }
  await plugin.printText({ text: receipt.text })
  return !receipt.qrUrl
}

export async function printOrderReceipt(
  receipt: OrderReceipt,
): Promise<{ ok: boolean; error?: string; driver?: string; qrPrinted?: boolean }> {
  const network = await printOnNetworkPrinter(receipt.text)
  if (network.ok) {
    return { ok: true, driver: 'network', qrPrinted: false }
  }
  const networkError = network.error ?? ''

  let zcsReason = ''
  try {
    const zcs = await ZcsPrint.isAvailable()
    if (!zcs.available && zcs.reason) zcsReason = zcs.reason
    if (zcs.available) {
      const qrOnlyText = await printReceiptOnPlugin(ZcsPrint, receipt)
      return { ok: true, driver: 'zcs', qrPrinted: Boolean(receipt.qrUrl) && !qrOnlyText }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ZCS print failed'
    return { ok: false, error: message, driver: 'zcs' }
  }

  let kingtopReason = ''
  try {
    const kingtop = await KingtopPrint.isAvailable()
    if (!kingtop.available && kingtop.reason) {
      kingtopReason = kingtop.reason
    }
    if (kingtop.available) {
      const qrOnlyText = await printReceiptOnPlugin(KingtopPrint, receipt)
      return { ok: true, driver: 'kingtop', qrPrinted: Boolean(receipt.qrUrl) && !qrOnlyText }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kingtop print failed'
    return { ok: false, error: message, driver: 'kingtop' }
  }

  try {
    const sunmi = await SunmiPrint.isAvailable()
    if (sunmi.available) {
      await SunmiPrint.printText({ text: receipt.text })
      return { ok: true, driver: 'sunmi', qrPrinted: false }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sunmi print failed'
    return { ok: false, error: message, driver: 'sunmi' }
  }

  let detail = 'No supported printer found.'
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
  zcs: { driverManagerFound: boolean; available: boolean; lastError: string }
  kingtop: { handlerClassesFound: string; available: boolean; lastError: string; initPath: string }
}

export async function getPrinterDiagnostics(): Promise<PrinterDiagnostics> {
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

  return { zcs, kingtop }
}
