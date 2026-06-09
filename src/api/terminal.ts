import { http, unwrapData } from './http.js'
import type { TerminalActivateResponse } from '../types/terminal.js'

export const terminalApi = {
  activate: async (branch_code: string, deviceId?: string): Promise<TerminalActivateResponse> => {
    const response = await http.post('/api/terminal/activate', {
      branch_code,
      deviceId,
    })
    return unwrapData<TerminalActivateResponse>(response.data)
  },

  ping: async (): Promise<boolean> => {
    try {
      const response = await http.get('/health')
      return response.status === 200
    } catch {
      return false
    }
  },
}
