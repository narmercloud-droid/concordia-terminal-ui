import { dailyReportApi } from '../api/dailyReport.js'
import { printOnDevice } from '../native/devicePrint.js'

export async function printDayReport(): Promise<{ ok: boolean; message: string }> {
  const report = await dailyReportApi.getToday()
  const printed = await printOnDevice(report.receiptText)
  if (printed.ok) {
    return { ok: true, message: 'Tagesabschluss gedruckt.' }
  }
  return {
    ok: false,
    message: printed.error ?? 'Druck fehlgeschlagen. Sunmi-Drucker prüfen oder erneut versuchen.',
  }
}
