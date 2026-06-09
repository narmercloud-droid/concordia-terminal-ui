import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login.js'
import Orders from './pages/Orders.js'
import OrderDetails from './pages/OrderDetails.js'
import DayReport from './pages/DayReport.js'
import { Header } from './components/Header.js'
import { ProtectedRoute } from './components/ProtectedRoute.js'
import { useTerminalStore } from './store/terminalStore.js'
import { useHardwareBack } from './hooks/useHardwareBack.js'
import { IncomingOrderOverlay } from './components/IncomingOrderOverlay.js'
import './App.css'

function App() {
  const isAuthenticated = useTerminalStore((state) => state.isAuthenticated)
  useHardwareBack('/orders')

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
