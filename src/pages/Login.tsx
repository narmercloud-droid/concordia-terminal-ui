import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { z } from 'zod'
import axios from 'axios'
import { terminalApi } from '../api/terminal.js'
import { useTerminalStore } from '../store/terminalStore.js'
import { ErrorMessage } from '../components/ErrorMessage.js'
import { useI18n } from '../i18n/index.js'
import '../App.css'

function loginErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return 'Cannot reach the server. Check Wi‑Fi and wait ~30s if the backend is waking up, then try again.'
    }
    const body = err.response.data as { error?: string; message?: string } | undefined
    const apiMsg = body?.error ?? body?.message
    if (apiMsg) return apiMsg
    if (err.response.status === 404) {
      return 'Invalid branch code. Use KEMPEN (Kempen) or STRAELEN (Straelen).'
    }
  }
  return 'Connection failed. Check Wi‑Fi and try again.'
}

const loginSchema = z.object({
  branch_code: z.string().trim().min(3, 'Branch code is required'),
})

const Login = () => {
  const t = useI18n((s) => s.t)
  const [branch_code, setBranchCode] = useState('KEMPEN')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isAuthenticated = useTerminalStore((state) => state.isAuthenticated)
  const branch_id = useTerminalStore((state) => state.branch_id)
  const login = useTerminalStore((state) => state.login)
  const logout = useTerminalStore((state) => state.logout)

  useEffect(() => {
    if (isAuthenticated && !branch_id) {
      logout()
    }
  }, [isAuthenticated, branch_id, logout])

  if (isAuthenticated && branch_id) {
    return <Navigate to="/orders" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const parsed = loginSchema.safeParse({ branch_code })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid branch code')
      return
    }

    setLoading(true)
    try {
      const payload = await terminalApi.activate(parsed.data.branch_code)
      login({
        branch_id: payload.branchId,
        branch_name: payload.branchName,
        terminal_code: payload.terminalCode,
        isAuthenticated: true,
      })
    } catch (err) {
      setError(loginErrorMessage(err))
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-shell">
      <section className="card login-card">
        <h1>{t('connectTitle')}</h1>
        <p>{t('connectSubtitle')}</p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label htmlFor="branch_code">{t('branchCode')}</label>
          <input
            id="branch_code"
            type="text"
            value={branch_code}
            onChange={(event) => setBranchCode(event.target.value.toUpperCase())}
            placeholder="KEMPEN"
            autoComplete="off"
            disabled={loading}
          />

          {error && <ErrorMessage message={error} />}

          <button className="button primary" type="submit" disabled={loading}>
            {loading ? t('connecting') : t('connect')}
          </button>
        </form>
      </section>
    </div>
  )
}

export default Login
