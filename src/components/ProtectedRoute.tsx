import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useTerminalStore } from '../store/terminalStore.js'

type Props = {
  children: ReactNode
}

export const ProtectedRoute = ({ children }: Props) => {
  const isAuthenticated = useTerminalStore((state) => state.isAuthenticated)
  const branch_id = useTerminalStore((state) => state.branch_id)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!branch_id) {
    return <Navigate to="/login" replace state={{ sessionError: true }} />
  }

  return <>{children}</>
}
