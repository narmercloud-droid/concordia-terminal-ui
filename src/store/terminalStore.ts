import { create } from 'zustand'
import type { TerminalSession } from '../types/terminal.js'
import { branchApi } from '../api/branch.js'
import { useOrderStore } from './orderStore.js'

const STORAGE_KEY = 'concordia_terminal_session'

interface TerminalState extends TerminalSession {
  ordersPaused: boolean
  login: (session: TerminalSession) => void
  logout: () => void
  loadBranchStatus: (branchId: string) => Promise<void>
  setOrdersPaused: (paused: boolean) => Promise<void>
}

const emptySession = (): TerminalSession => ({
  branch_id: '',
  branch_name: '',
  terminal_code: '',
  terminal_id: '',
  activation_token: '',
  isAuthenticated: false,
})

function normalizeSession(raw: Record<string, unknown>): TerminalSession {
  const branch_id = String(raw.branch_id ?? raw.branchId ?? '').trim()
  const branch_name = String(raw.branch_name ?? raw.branchName ?? '').trim()
  const terminal_code = String(raw.terminal_code ?? raw.terminalCode ?? '').trim()
  const terminal_id = String(raw.terminal_id ?? raw.terminalId ?? '').trim()
  const activation_token = String(raw.activation_token ?? raw.activationToken ?? '').trim()
  return {
    branch_id,
    branch_name,
    terminal_code,
    terminal_id,
    activation_token,
    isAuthenticated: Boolean(branch_id && terminal_code && activation_token),
  }
}

const getInitialSession = (): TerminalSession => {
  if (typeof window === 'undefined') return emptySession()

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return emptySession()

  try {
    const session = normalizeSession(JSON.parse(stored) as Record<string, unknown>)
    // Force re-activate if older sessions lack tokens
    if (!session.activation_token) {
      window.localStorage.removeItem(STORAGE_KEY)
      return emptySession()
    }
    return session
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return emptySession()
  }
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  ...getInitialSession(),
  ordersPaused: false,
  login: (session) => {
    const nextSession = normalizeSession({
      ...session,
      isAuthenticated: true,
    })
    if (!nextSession.branch_id || !nextSession.terminal_code || !nextSession.activation_token) {
      throw new Error('Invalid terminal session from server')
    }
    nextSession.isAuthenticated = true
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession))
    set(nextSession)
  },
  logout: () => {
    window.localStorage.removeItem(STORAGE_KEY)
    useOrderStore.getState().clearOrders()
    set(() => ({ ...emptySession(), ordersPaused: false }))
  },
  loadBranchStatus: async (branchId) => {
    if (!branchId) return
    const status = await branchApi.getStatus(branchId)
    set({ ordersPaused: status.ordersPaused })
  },
  setOrdersPaused: async (paused) => {
    const branchId = get().branch_id
    if (!branchId) return
    const status = await branchApi.setOrdersPaused(branchId, paused)
    set({ ordersPaused: status.ordersPaused })
  },
}))

export const getBranchId = (): string => useTerminalStore.getState().branch_id
