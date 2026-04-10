import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export default function AdminLogin() {
  const [pwd, setPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, init } = useAuthStore()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pwd.trim()) return
    setLoading(true)
    await init()
    const ok = await login(pwd)
    setLoading(false)
    if (ok) {
      toast.success('Bem-vindo, Admin!')
      navigate('/', { replace: true })
    } else {
      toast.error('Senha incorreta.')
      setPwd('')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 20
    }}>
      <div className="card" style={{ maxWidth: 380, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Área Administrativa</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Portal de Cadastros ANC
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Senha</label>
            <input
              type="password"
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              placeholder="Digite a senha"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading || !pwd.trim()}
          >
            {loading ? <span className="spinner" /> : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
          Acesso público disponível na <a href="/" style={{ color: 'var(--accent)' }}>página principal</a>
        </p>
      </div>
    </div>
  )
}
