import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'

export function LoginPage() {
  const navigate = useNavigate()
  const { setUser } = useAppStore()
  const [email, setEmail] = useState('admin@ruwi.io')
  const [password, setPassword] = useState('demo1234')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(email, password)
      setUser(result.user, result.token)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-3xl font-bold text-txt-primary">Ruwi</span>
            <span className="text-sm text-txt-muted bg-bg-elevated px-2 py-1 rounded font-mono">IoT</span>
          </div>
          <p className="text-txt-muted text-sm">Plataforma de monitoreo vertical</p>
          <div className="flex items-center justify-center gap-3 mt-2 text-xs text-txt-muted">
            <span>🌱 Agro</span>
            <span>·</span>
            <span>⚡ Energía</span>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-bg-surface border border-bg-border rounded-xl p-6">
          <h1 className="text-txt-primary font-semibold text-lg mb-5">Iniciar sesión</h1>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-950 border border-status-crit text-status-crit text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-txt-secondary text-sm mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-bg-elevated border border-bg-border rounded-md px-3 py-2.5
                           text-txt-primary text-sm placeholder-txt-muted
                           focus:outline-none focus:border-energy-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-txt-secondary text-sm mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-bg-elevated border border-bg-border rounded-md px-3 py-2.5
                           text-txt-primary text-sm placeholder-txt-muted
                           focus:outline-none focus:border-energy-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-energy-primary hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
                         text-white font-medium py-2.5 rounded-md transition-colors text-sm"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <p className="text-txt-muted text-xs text-center mt-4">
            Demo: usa cualquier email y contraseña
          </p>
        </div>
      </div>
    </div>
  )
}
