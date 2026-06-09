import { http, unwrapData } from './http.js'

export interface BranchStatus {
  branchId: string
  status: string
  ordersPaused: boolean
}

export const branchApi = {
  getStatus: async (branchId: string): Promise<BranchStatus> => {
    const response = await http.get('/api/terminal/branch/status', { params: { branchId } })
    return unwrapData<BranchStatus>(response.data)
  },

  setOrdersPaused: async (branchId: string, ordersPaused: boolean): Promise<BranchStatus> => {
    const response = await http.patch('/api/terminal/branch/status', { branchId, ordersPaused })
    return unwrapData<BranchStatus>(response.data)
  },
}
