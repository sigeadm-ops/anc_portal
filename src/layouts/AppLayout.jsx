import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../api/supabase'

const NAV_PUBLIC = [
  { to: '/', icon: '🏠', label: 'Dashboard', end: true },
  { to: '/bases', icon: '⛪', label: 'Bases' },
  { to: '/membros', icon: '👥', label: 'Membros' },
  { to: '/notas', icon: '📋', label: 'Notas Teen' },
  { to: '/notas-soul', icon: '📋', label: 'Notas Soul+' },
// { to: '/pontuacoes', icon: '🏆', label: 'Pontuações' },
  { to: '/relatorios', icon: '📊', label: 'Relatórios' },
]

const NAV_ADMIN = [
  { to: '/admin/provas', icon: '📝', label: 'Gerenciar Provas' },
  { to: '/admin/config', icon: '⚙️', label: 'Configurações' },
]

// Páginas que ativam o tema Soul+
const SOUL_ROUTES = ['/notas-soul']

// Título de cada rota
const PAGE_TITLES = {
  '/': { icon: '🏠', title: 'Dashboard' },
  '/bases': { icon: '⛪', title: 'Cadastro de Bases' },
  '/membros': { icon: '👥', title: 'Cadastro de Membros' },
  '/notas': { icon: '📋', title: 'Notas BEP Teen' },
  '/notas-soul': { icon: '📋', title: 'Notas Provinha Soul+' },
  '/pontuacoes': { icon: '🏆', title: 'Pontuações' },
  '/relatorios': { icon: '📊', title: 'Relatório Geral' },
  '/admin/provas': { icon: '📝', title: 'Gerenciar Provas' },
  '/admin/config': { icon: '⚙️', title: 'Configurações Admin' },
  '/admin/login': { icon: '🔒', title: 'Login Admin' },
}

export default function AppLayout() {
  const [connOk, setConnOk] = useState(null)
  const { isAdmin, logout } = useAuthStore()
  const location = useLocation()

  // Estado da sidebar (recolhida ou não) -- persiste no localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  // Estado para mobile (aberto ou não)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const toggleSidebar = () => {
    if (window.innerWidth <= 900) {
      setIsMobileOpen(!isMobileOpen)
    } else {
      const newState = !isCollapsed
      setIsCollapsed(newState)
      localStorage.setItem('sidebar-collapsed', newState)
    }
  }

  // Fecha sidebar no mobile ao navegar
  useEffect(() => { setIsMobileOpen(false) }, [location.pathname])

  // Testa conexão Supabase ao montar
  useEffect(() => {
    supabase
      .from('bases')
      .select('id', { count: 'exact', head: true })
      .then(({ error }) => setConnOk(!error))
      .catch(() => setConnOk(false))
  }, [])

  // Tema Soul+: ativo na rota /notas-soul
  // Páginas de Bases e Membros ativam via seletor de tipo — tratado dentro de cada page
  const isSoul = SOUL_ROUTES.some(r => location.pathname.startsWith(r))
  const pageInfo = PAGE_TITLES[location.pathname] || { icon: '📄', title: 'Portal ANC' }

  return (
    <div className="layout">

      {/* ── Overlay mobile ── */}
      <div
        className={`sidebar-overlay ${isMobileOpen ? 'open' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'open' : ''}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-icon">⛪</div>
          <div className="logo-text">
            <div className="logo-title">Portal ANC</div>
            <div className="logo-sub">G148 · Soul+</div>
          </div>
        </div>

        {/* Nav pública */}
        <nav className="nav-section">
          <div className="nav-section-label">Menu</div>
          {NAV_PUBLIC.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Nav admin */}
        {isAdmin && (
          <nav className="nav-section">
            <div className="nav-section-label">Admin</div>
            {NAV_ADMIN.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
            <button
              className="nav-item"
              onClick={logout}
              style={{ color: 'var(--bad)' }}
            >
              <span className="nav-icon">🚪</span>
              <span className="nav-label">Sair do Admin</span>
            </button>
          </nav>
        )}

        {/* Botão login admin (quando não logado) - OCULTO TEMPORARIAMENTE
        {!isAdmin && (
          <nav className="nav-section">
            <NavLink to="/admin/login" className="nav-item">
              <span className="nav-icon">🔒</span>
              <span className="nav-label">Área Admin</span>
            </NavLink>
          </nav>
        )}
        */}

        {/* Rodapé sidebar */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className={`conn-dot ${connOk === true ? 'ok' : connOk === false ? 'err' : ''}`} />
            <span className="nav-label">
              {connOk === true
                ? 'Supabase conectado'
                : connOk === false
                  ? 'Sem conexão'
                  : 'Verificando...'}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className={`main-content ${isSoul ? 'theme-soul' : ''} ${isCollapsed ? 'sidebar-collapsed' : ''}`} id="main">

        {/* Topbar */}
        <header className="topbar">
          <button
            className="menu-toggle"
            onClick={toggleSidebar}
            aria-label="Menu"
          >
            {isCollapsed ? '➡️' : '⬅️'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 18 }}>{pageInfo.icon}</span>
            <span className="topbar-title">{pageInfo.title}</span>
          </div>

          {/* Badge modo auditoria */}
          <span className="topbar-badge badge-auditoria">🔍 Auditoria</span>

          {isAdmin && (
            <span className="topbar-badge badge-admin">Admin</span>
          )}
        </header>

        {/* Conteúdo da página */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
