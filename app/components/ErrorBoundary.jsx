'use client'
import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.name || 'unknown', error, info)
  }

  render() {
    if (this.state.hasError) {
      const isSection = !!this.props.name
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: isSection ? '20vh' : '40vh', gap: 16, padding: isSection ? 20 : 32
        }}>
          <p style={{ color: 'var(--red, #e53)', fontWeight: 600, fontSize: isSection ? 13 : 16 }}>
            {isSection ? `Error en ${this.props.name}` : 'Algo salio mal al renderizar este modulo.'}
          </p>
          <pre style={{
            fontSize: 12, background: 'var(--bg2)', padding: '8px 12px',
            borderRadius: 6, maxWidth: 600, overflow: 'auto', color: 'var(--tx2)'
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: 'var(--accent, #3b82f6)', color: '#fff',
              fontWeight: 600, cursor: 'pointer', fontSize: 14
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
