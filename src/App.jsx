import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Bases from './pages/Bases'
import Membros from './pages/Membros'
import Notas from './pages/Notas'
import Desafios from './pages/Desafios'
import Ranking from './pages/Ranking'
import Relatorios from './pages/Relatorios'
import Provas from './pages/Provas'
import Departamentos from './pages/Departamentos'
import AdminConfig from './pages/AdminConfig'
import AdminLogin from './pages/AdminLogin'

import { useUIStore } from './store/uiStore'

// Modal de Erro Global
function GlobalErrorModal() {
  const { error, clearError } = useUIStore()
  if (!error) return null

  // Quebra de linha no message (ex.: texto com \n\n)
  const lines = String(error.message || '').split('\n').filter(Boolean)

  return (
    <div className="error-modal-backdrop" onClick={clearError}>
      <div className="error-modal" onClick={e => e.stopPropagation()}>
        <div className="error-modal-header">
          <div className="error-icon-container">⚠️</div>
          <h2 className="error-modal-title">{error.title}</h2>
        </div>
        <div className="error-modal-message">
          {lines.map((line, i) => (
            <p key={i} style={{ margin: i === 0 ? '0 0 10px' : '0' }}>{line}</p>
          ))}
        </div>
        {error.contactAdmin && (
          <div className="error-admin-notice">
            <span className="error-admin-icon">👤</span>
            Em caso de dúvidas, procure o <strong>administrador do sistema</strong>.
          </div>
        )}
        {error.technicalInfo && (
          <div className="error-technical">
            <strong>Detalhe técnico:</strong><br/>
            {error.technicalInfo}
          </div>
        )}
        <div className="error-modal-footer">
          <button className="error-btn-primary" onClick={clearError}>Entendido</button>
        </div>
      </div>
    </div>
  )
}

// Guard para rotas admin
function AdminRoute({ children }) {
  const isAdmin = useAuthStore(s => s.isAdmin)
  if (!isAdmin) return <Navigate to="/admin/login" replace />
  return children
}

export default function App() {
  return (
    <>
      <GlobalErrorModal />
      <Routes>
        {/* Rota pública de login admin */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Todas as outras rotas usam o layout com sidebar */}
        <Route element={<AppLayout />}>
          {/* Rota inicial */}
          <Route index element={<Dashboard />} />

          {/* Rota DINÂMICAS por TIPO (teen ou soul) */}
          <Route path=":type">
            <Route path="bases" element={<Bases />} />
            <Route path="membros" element={<Membros />} />
            <Route path="notas" element={<Notas />} />
            <Route path="desafios" element={<Desafios />} />
            <Route path="ranking" element={<Ranking />} />
          </Route>

          {/* Mantém rotas legadas ou específicas sem prefixo para compatibilidade imediata */}
          <Route path="bases" element={<Bases />} />
          <Route path="membros" element={<Membros />} />
          <Route path="notas" element={<Notas />} />
          <Route path="notas-soul" element={<Navigate to="/soul/notas" replace />} />
          <Route path="desafios" element={<Desafios />} />
          <Route path="ranking" element={<Ranking />} />
          <Route path="relatorios" element={<Relatorios />} />

          {/* Rotas ADMIN — requerem autenticação */}
          <Route path="admin/departamentos" element={
            <AdminRoute><Departamentos /></AdminRoute>
          } />
          <Route path="admin/config" element={
            <AdminRoute><AdminConfig /></AdminRoute>
          } />
          <Route path="admin/config/:min" element={
            <AdminRoute><AdminConfig /></AdminRoute>
          } />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
