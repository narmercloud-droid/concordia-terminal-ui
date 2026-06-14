import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login.js'
import Orders from './pages/Orders.js'
import OrderDetails from './pages/OrderDetails.js'
import DayReport from './pages/DayReport.js'
import { Header } from './components/Header.js'
import { ProtectedRoute } from './components/ProtectedRoute.js'
import { useTerminalStore } from './store/terminalStore.js'
import { useHardwareBack } from './hooks/useHardwareBack.js'
import { IncomingOrderOverlay } from './components/IncomingOrderOverlay.js'
import { startOrderRealtime, stopOrderRealtime } from './services/orderRealtime.js'
import './App.css'

function App() {
  const isAuthenticated = useTerminalStore((state) => state.isAuthenticated)
  const branch_id = useTerminalStore((state) => state.branch_id)
  useHardwareBack('/orders')

  useEffect(() => {
    if (isAuthenticated && branch_id) {
      startOrderRealtime()
      return () => {
        stopOrderRealtime()
      }
    }
    stopOrderRealtime()
  }, [isAuthenticated, branch_id])

  return (
    <div className="app-shell">
      {isAuthenticated && <Header />}
      {isAuthenticated && <IncomingOrderOverlay />}
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:order_id"
            element={
              <ProtectedRoute>
                <OrderDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="/day-report"
            element={
              <ProtectedRoute>
                <DayReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={<Navigate to={isAuthenticated ? '/orders' : '/login'} replace />}
          />
          <Route
            path="*"
            element={<Navigate to={isAuthenticated ? '/orders' : '/login'} replace />}
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
