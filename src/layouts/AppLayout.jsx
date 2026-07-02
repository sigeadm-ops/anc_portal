import { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../api/supabase'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { useAppVersion } from '../hooks/useAppVersion'

// Sub-abas da página de Desafios, expostas como atalhos diretos no menu
// lateral (a página continua no mesmo lugar — isso só abre direto na aba).
const DESAFIOS_SUBTABS = [
  { tab: 'comparativo', icon: '📊', label: 'Comparativo' },
  { tab: 'discipulos',  icon: '📖', label: 'Discípulos' },
  { tab: 'batismos',    icon: '🕊️', label: 'Batismos' },
  { tab: 'fotos',       icon: '🖼️', label: 'Fotos' },
]

function desafiosSubmenu(base) {
  return DESAFIOS_SUBTABS.map(s => ({ to: `${base}?tab=${s.tab}`, icon: s.icon, label: s.label }))
}

const NAV_SOUL = [
  { to: '/soul/bases',    icon: '⛪', label: 'Bases' },
  { to: '/soul/membros',  icon: '👥', label: 'Membros' },
  { to: '/soul/notas',    icon: '📋', label: 'Notas Soul+' },
  { to: '/soul/desafios', icon: '🏅', label: 'Desafios', submenu: desafiosSubmenu('/soul/desafios') },
  { to: '/soul/ranking',  icon: '🏆', label: 'Ranking' },
]

const NAV_TEEN = [
  { to: '/teen/bases',    icon: '⛪', label: 'Bases' },
  { to: '/teen/membros',  icon: '👥', label: 'Membros' },
  { to: '/teen/notas',    icon: '📋', label: 'Notas Teen' },
  { to: '/teen/desafios', icon: '🏅', label: 'Desafios', submenu: desafiosSubmenu('/teen/desafios') },
  { to: '/teen/ranking',  icon: '🏆', label: 'Ranking' },
]

const NAV_ADMIN = [
  { to: '/admin/departamentos', icon: '🧭', label: 'Departamentos' },
  { to: '/admin/config', icon: '⚙️', label: 'Configurações Gerais' },
]

// Título de cada rota (com suporte a dinâmico)
const PAGE_TITLES = {
  '/': { icon: '🏠', title: 'Dashboard' },
  '/relatorios': { icon: '📊', title: 'Relatório Geral' },
  '/admin/departamentos': { icon: '🧭', title: 'Departamentos do Discipulado' },
  '/admin/config': { icon: '⚙️', title: 'Configurações Admin' },
}

// Item de menu com submenu opcional (usado por Desafios: Comparativo,
// Discípulos, Batismos, Fotos). O link principal navega normalmente; a
// setinha só expande/recolhe a lista de atalhos, sem navegar.
function NavItemWithSubmenu({ item, expanded, onToggleExpand, isSubmenuItemActive, soulStyle = false }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <NavLink
          to={item.to}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          style={({ isActive }) => ({
            flex: 1,
            ...(soulStyle ? {
              color: '#3E2000',
              background: isActive ? 'rgba(62,32,0,.1)' : 'transparent',
              fontWeight: isActive ? 800 : 500,
            } : {}),
          })}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </NavLink>
        {item.submenu && (
          <button
            type="button"
            onClick={() => onToggleExpand(item.to)}
            aria-label={expanded ? 'Recolher atalhos' : 'Expandir atalhos'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 14px', color: soulStyle ? '#3E2000' : 'inherit', opacity: 0.7,
            }}
          >
            {expanded ? '▾' : '▸'}
          </button>
        )}
      </div>
      {item.submenu && expanded && (
        <div>
          {item.submenu.map(sub => {
            const active = isSubmenuItemActive(sub.to)
            return (
              <NavLink
                key={sub.to}
                to={sub.to}
                className={`nav-item ${active ? 'active' : ''}`}
                style={{
                  paddingLeft: 44,
                  fontSize: 13,
                  ...(soulStyle ? {
                    color: '#3E2000',
                    background: active ? 'rgba(62,32,0,.1)' : 'transparent',
                    fontWeight: active ? 800 : 500,
                  } : {}),
                }}
              >
                <span className="nav-icon">{sub.icon}</span>
                <span className="nav-label">{sub.label}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

function getPageInfo(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length >= 2) {
    const type = parts[0] === 'soul' ? 'Soul+' : 'G148 Teen'
    const page = parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
    const icons = { bases: '⛪', membros: '👥', notas: '📋', desafios: '🏅', ranking: '🏆' }
    return { icon: icons[parts[1]] || '📄', title: `${page} — ${type}` }
  }
  return { icon: '📄', title: 'G148 Teen' }
}

export default function AppLayout() {
  const [connOk, setConnOk] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const { isAdmin, isAuditMode, adminUser, toggleAuditMode, logout } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Itens de menu com submenu (ex.: Desafios) começam expandidos se a rota
  // atual já for a deles; depois disso o usuário controla manualmente.
  const [expandedNav, setExpandedNav] = useState(() => {
    const initial = new Set()
    ;[...NAV_SOUL, ...NAV_TEEN].forEach(item => {
      if (item.submenu && location.pathname === item.to) initial.add(item.to)
    })
    return initial
  })

  function toggleNavExpanded(to) {
    setExpandedNav(prev => {
      const next = new Set(prev)
      next.has(to) ? next.delete(to) : next.add(to)
      return next
    })
  }

  function isSubmenuItemActive(subTo) {
    const [subPath, subQuery] = subTo.split('?')
    if (location.pathname !== subPath) return false
    const currentTab = new URLSearchParams(location.search).get('tab')
    const subTab = new URLSearchParams(subQuery || '').get('tab')
    return currentTab === subTab
  }

  useRealtimeSync()
  useAppVersion()

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }, [queryClient])

  async function handleLogout() {
    await logout()
    navigate('/', { replace: true })
  }

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

  // Testa conexão Supabase ao montar (tenta ambos os schemas: normalizado e legacy)
  useEffect(() => {
    supabase
      .from('bases')
      .select('id', { count: 'exact', head: true })
      .then(({ error }) => {
        if (!error) { setConnOk(true); return }
        // Fallback para schema legado com PascalCase
        return supabase
          .from('Bases')
          .select('id_base', { count: 'exact', head: true })
          .then(({ error: e2 }) => setConnOk(!e2))
      })
      .catch(() => setConnOk(false))
  }, [])

  async function handleToggleAudit() {
    if (isAuditMode) {
      toggleAuditMode('') // Desativa sem senha
      return
    }
    const pwd = prompt('Digite a Master Password para liberar edição:')
    if (!pwd) return
    const ok = await toggleAuditMode(pwd)
    if (!ok) alert('Senha incorreta!')
  }

  // Tema Soul+: ativo em rotas Soul+ canônicas e fallbacks legados
  const pathname = location.pathname.toLowerCase()
  const isSoul =
    pathname === '/soul' ||
    pathname.startsWith('/soul/') ||
    pathname.startsWith('/admin/config/soul') ||
    pathname === '/notas-soul'
  const pageInfo = getPageInfo(location.pathname)

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
            <div className="logo-title" style={{ fontSize: 20, letterSpacing: '1px' }}>PORTAL ANC</div>
            <div className="logo-sub" style={{ fontWeight: 800, opacity: 0.9 }}>SOUL+ · G148 TEEN</div>
          </div>
        </div>

        {/* Home */}
        <nav className="nav-section">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Dashboard</span>
          </NavLink>
          <NavLink to="/relatorios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">📊</span>
            <span className="nav-label">Relatórios Geral</span>
          </NavLink>
        </nav>

        {/* Seção SOUL+ */}
        <nav className="nav-section" style={{ background: '#FFE082', borderBottom: '1px solid rgba(62,32,0,.15)' }}>
          <div className="nav-section-label" style={{ color: '#3E2000', fontWeight: 800 }}>Pré Adolescentes - Soul+</div>
          {NAV_SOUL.map(item => (
            <NavItemWithSubmenu
              key={item.to}
              item={item}
              expanded={expandedNav.has(item.to)}
              onToggleExpand={toggleNavExpanded}
              isSubmenuItemActive={isSubmenuItemActive}
              soulStyle
            />
          ))}
        </nav>

        {/* Seção TEEN */}
        <nav className="nav-section" style={{ borderLeft: '4px solid var(--c1)', background: 'rgba(124,58,237,.03)' }}>
          <div className="nav-section-label" style={{ color: 'var(--c1)' }}>Adolescentes - G148 teen</div>
          {NAV_TEEN.map(item => (
            <NavItemWithSubmenu
              key={item.to}
              item={item}
              expanded={expandedNav.has(item.to)}
              onToggleExpand={toggleNavExpanded}
              isSubmenuItemActive={isSubmenuItemActive}
            />
          ))}
        </nav>

        {/* Nav admin */}
        {(isAdmin || isAuditMode) && (
          <nav className="nav-section">
            <div className="nav-section-label">Administração</div>
            
            {/* Relatórios e Config Gerais */}
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

            {/* Configs específicas por ministério no bloco admin */}
            <hr style={{ opacity: 0.1, margin: '8px 16px' }} />
            
            <NavLink
              to="/admin/config/soul"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={({ isActive }) => ({
                color: isActive ? 'var(--soul-brown)' : '#FFD54F',
                background: isActive ? 'var(--soul-amber)' : 'transparent',
                fontWeight: isActive ? 800 : 500,
              })}
            >
              <span className="nav-icon">☀️</span>
              <span className="nav-label">Config. Soul+</span>
            </NavLink>

            <NavLink
              to="/admin/config/teen"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={({ isActive }) => ({
                color: isActive ? '#fff' : 'var(--c1-l)',
                background: isActive ? 'var(--c1)' : 'transparent',
                fontWeight: isActive ? 800 : 500,
              })}
            >
              <span className="nav-icon">⚡</span>
              <span className="nav-label">Config. Teen</span>
            </NavLink>

            <button
              className="nav-item"
              onClick={handleLogout}
              style={{ color: 'var(--bad)', marginTop: 8 }}
            >
              <span className="nav-icon">🚪</span>
              <span className="nav-label">Sair do Admin</span>
            </button>
          </nav>
        )}

        {/* Botão login admin (quando não logado) */}
        {!isAdmin && !isAuditMode && (
          <nav className="nav-section" style={{ marginTop: 'auto' }}>
            <NavLink to="/admin/login" className="nav-item">
              <span className="nav-icon">🔒</span>
              <span className="nav-label">Área Admin</span>
            </NavLink>
          </nav>
        )}

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

          {/* Botão de atualizar dados */}
          <button
            className="topbar-badge"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Atualizar dados da página"
            style={{
              cursor: refreshing ? 'default' : 'pointer',
              border: 'none',
              outline: 'none',
              opacity: refreshing ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                animation: refreshing ? 'spin 0.7s linear infinite' : 'none',
              }}
            >
              🔄
            </span>
            <span className="nav-label">Atualizar</span>
          </button>

          {/* Badge modo auditoria */}
          <button
            className={`topbar-badge badge-auditoria ${isAuditMode ? 'active' : ''}`}
            onClick={handleToggleAudit}
            style={{ cursor: 'pointer', border: 'none', outline: 'none' }}
          >
            {isAuditMode ? '🔓 Edição Ativa' : '🔍 Auditoria'}
          </button>

          {isAdmin && (
            <span className="topbar-badge badge-admin">👤 {adminUser || 'Admin'}</span>
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
