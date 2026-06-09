import { http, unwrapData } from './http.js'
import { getBranchId } from '../store/terminalStore.js'

export type DailyReport = {
  branchName: string
  date: string
  dateLabel: string
  orderCount: number
  cancelledCount: number
  grossRevenue: number
  deliveryFees: number
  discounts: number
  netRevenue: number
  avgOrderValue: number
  delivery: { count: number; revenue: number }
  pickup: { count: number; revenue: number }
  paymentBreakdown: Array<{ method: string; count: number; total: number }>
  receiptText: string
  receiptLines: string[]
}

export const dailyReportApi = {
  getToday: async (): Promise<DailyReport> => {
    const branchId = getBranchId()
    const response = await http.get('/api/terminal/daily-report', {
      params: { branchId },
    })
    return unwrapData<DailyReport>(response.data)
  },
}
