import { http } from './http.js'
import { useTerminalStore } from '../store/terminalStore.js'

const WARMUP_MS = 3 * 60 * 1000

let timer: number | null = null

/** Keep Render backend warm so status updates respond in ~2s instead of ~30s. */
export function startBackendWarmup() {
  stopBackendWarmup()
  const ping = () => {
    const branchId = useTerminalStore.getState().branch_id
    if (!branchId) return
    void http
      .get('/api/terminal/branch/status', { params: { branchId }, timeout: 8_000 })
      .catch(() => {
        // best-effort
      })
  }
  ping()
  timer = window.setInterval(ping, WARMUP_MS)
}

export function stopBackendWarmup() {
  if (timer != null) {
    window.clearInterval(timer)
    timer = null
  }
}
