import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function useHardwareBack(fallbackPath = '/orders') {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handler = () => {
      if (location.pathname.startsWith('/orders/') && location.pathname !== '/orders') {
        navigate('/orders')
        return
      }
      if (location.pathname === '/menu' || location.pathname === '/day-report') {
        navigate(fallbackPath)
        return
      }
      if (location.pathname !== fallbackPath && location.pathname !== '/login') {
        navigate(fallbackPath)
      }
    }

    window.addEventListener('concordia-hardware-back', handler)
    return () => window.removeEventListener('concordia-hardware-back', handler)
  }, [location.pathname, navigate, fallbackPath])
}
