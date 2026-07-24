import { Capacitor, registerPlugin } from '@capacitor/core'

interface TerminalKeepAlivePlugin {
  startKeepAlive(options: { branchId: string; branchName: string }): Promise<void>
  stopKeepAlive(): Promise<void>
  bringToFront(): Promise<void>
  alertNewOrder(options?: { summary?: string }): Promise<void>
  isSessionActive(): Promise<{ active: boolean }>
}

const TerminalKeepAlive = registerPlugin<TerminalKeepAlivePlugin>('TerminalKeepAlive')

export async function startKeepAlive(branchId: string, branchName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await TerminalKeepAlive.startKeepAlive({ branchId, branchName })
  } catch {
    // keep-alive is best-effort on unsupported builds
  }
}

export async function stopKeepAlive(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await TerminalKeepAlive.stopKeepAlive()
  } catch {
    // ignore
  }
}

export async function bringAppToFront(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await TerminalKeepAlive.bringToFront()
  } catch {
    // ignore
  }
}

export async function alertNewOrder(summary?: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await TerminalKeepAlive.alertNewOrder({ summary: summary ?? '' })
  } catch {
    try {
      await TerminalKeepAlive.bringToFront()
    } catch {
      // ignore
    }
  }
}
