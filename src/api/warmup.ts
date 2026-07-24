import { http } from './http.js'

/** Render spins down after ~15 min idle; ping every 3 min while logged in (lighter on the tablet). */
const WARMUP_MS = 3 * 60 * 1000

let timer: number | null = null

/** Keep Render + Neon warm so API calls respond in ~1–2s instead of ~30s after idle. */
export function startBackendWarmup() {
  stopBackendWarmup()
  const ping = () => {
    void http.get('/health', { timeout: 8_000 }).catch(() => {
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
