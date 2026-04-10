import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Bases from './pages/Bases'
import Membros from './pages/Membros'
import Notas from './pages/Notas'
import NotasSoul from './pages/NotasSoul'
import Pontuacoes from './pages/Pontuacoes'
import Relatorios from './pages/Relatorios'
import Provas from './pages/Provas'
import AdminConfig from './pages/AdminConfig'
import AdminLogin from './pages/AdminLogin'

// Guard para rotas admin
function AdminRoute({ children }) {
  const isAdmin = useAuthStore(s => s.isAdmin)
  if (!isAdmin) return <Navigate to="/admin/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Rota pública de login admin */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Todas as outras rotas usam o layout com sidebar */}
      <Route element={<AppLayout />}>
        {/* Rotas PÚBLICAS — qualquer pessoa com o link acessa */}
        <Route index element={<Dashboard />} />
        <Route path="bases" element={<Bases />} />
        <Route path="membros" element={<Membros />} />
        <Route path="notas" element={<Notas />} />
        <Route path="notas-soul" element={<NotasSoul />} />
        <Route path="pontuacoes" element={<Pontuacoes />} />
        <Route path="relatorios" element={<Relatorios />} />

        {/* Rotas ADMIN — requerem autenticação */}
        <Route path="admin/provas" element={
          <AdminRoute><Provas /></AdminRoute>
        } />
        <Route path="admin/config" element={
          <AdminRoute><AdminConfig /></AdminRoute>
        } />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
