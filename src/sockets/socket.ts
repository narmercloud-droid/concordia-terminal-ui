import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export const createSocket = (apiUrl: string, branchId: string): Socket => {
  if (socket?.connected) return socket

  socket = io(apiUrl, {
    transports: ['polling', 'websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 2000,
  })

  socket.on('connect', () => {
    socket?.emit('join_terminal_branch', branchId)
  })

  return socket
}

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export const getSocket = (): Socket | null => socket
