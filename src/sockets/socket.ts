import { io, Socket } from 'socket.io-client'
import { useTerminalStore } from '../store/terminalStore.js'

let socket: Socket | null = null
let joinedBranchId = ''

export const createSocket = (apiUrl: string, branchId: string): Socket => {
  if (socket?.connected && joinedBranchId === branchId) return socket

  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }

  const { activation_token, terminal_id } = useTerminalStore.getState()

  joinedBranchId = branchId
  socket = io(apiUrl, {
    transports: ['websocket', 'polling'],
    upgrade: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
    auth: {
      terminal_token: activation_token,
      terminal_id,
    },
  })

  socket.on('connect', () => {
    const token = useTerminalStore.getState().activation_token
    socket?.emit('join_terminal_branch', { branchId, token })
  })

  return socket
}

export const disconnectSocket = (): void => {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
  joinedBranchId = ''
}

export const getSocket = (): Socket | null => socket

export const getJoinedBranchId = (): string => joinedBranchId
