import { dailyReportApi } from '../api/dailyReport.js'
import { printOnSunmi } from '../native/sunmiPrint.js'

export async function printDayReport(): Promise<{ ok: boolean; message: string }> {
  const report = await dailyReportApi.getToday()
  const printed = await printOnSunmi(report.receiptText)
  if (printed) {
    return { ok: true, message: 'Tagesabschluss gedruckt.' }
  }
  return {
    ok: false,
    message: 'Druck fehlgeschlagen. Sunmi-Drucker prüfen oder erneut versuchen.',
  }
}
