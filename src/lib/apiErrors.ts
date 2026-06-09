import axios from 'axios'

export function getApiErrorMessage(err: unknown): string | null {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error && err.message ? err.message : null
  }

  const data = err.response?.data
  if (!data) return err.message || null

  if (typeof data === 'string' && data.trim()) return data.trim()
  if (typeof data !== 'object') return err.message || null

  const body = data as {
    error?: string | { message?: string; code?: string }
    message?: string
  }

  if (typeof body.error === 'string' && body.error.trim()) return body.error.trim()
  if (body.error && typeof body.error === 'object' && typeof body.error.message === 'string') {
    return body.error.message
  }
  if (typeof body.message === 'string' && body.message.trim()) return body.message.trim()

  return err.message || null
}
