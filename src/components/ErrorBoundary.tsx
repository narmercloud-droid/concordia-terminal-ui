import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Terminal UI crash:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-shell">
          <section className="card login-card">
            <h1>Something went wrong</h1>
            <p style={{ color: '#b91c1c', marginBottom: 16 }}>
              {this.state.error.message || 'Unknown error'}
            </p>
            <button
              className="button primary"
              type="button"
              onClick={() => {
                window.localStorage.removeItem('concordia_terminal_session')
                window.location.hash = '#/login'
                window.location.reload()
              }}
            >
              Back to login
            </button>
          </section>
        </div>
      )
    }

    return this.props.children
  }
}
