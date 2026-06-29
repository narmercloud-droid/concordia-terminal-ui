import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
let joinedBranchId = ''

export const createSocket = (apiUrl: string, branchId: string): Socket => {
  if (socket?.connected && joinedBranchId === branchId) return socket

  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }

  joinedBranchId = branchId
  socket = io(apiUrl, {
    transports: ['websocket', 'polling'],
    upgrade: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
  })

  socket.on('connect', () => {
    socket?.emit('join_terminal_branch', branchId)
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
