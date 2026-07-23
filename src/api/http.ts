import axios from 'axios'
import { useTerminalStore } from '../store/terminalStore.js'

const baseURL =
  import.meta.env.VITE_API_URL ??
  import.meta.env.VITE_API_BASE_URL ??
  'https://api.concordiapizza.de'

export const http = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 45_000,
})

http.interceptors.request.use((config) => {
  const { activation_token, terminal_id } = useTerminalStore.getState()
  if (activation_token) {
    config.headers['x-terminal-token'] = activation_token
  }
  if (terminal_id) {
    config.headers['x-terminal-id'] = terminal_id
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = String(error.config?.url ?? '')
      if (!url.includes('/api/terminal/activate')) {
        useTerminalStore.getState().logout()
      }
    }
    return Promise.reject(error)
  }
)

export function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data
  }
  return payload as T
}
