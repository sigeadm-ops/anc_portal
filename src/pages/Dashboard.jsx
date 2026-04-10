import { useTable } from '../hooks/useTable'

export default function Dashboard() {
  const { data: bases } = useTable('Bases')
  const { data: membros } = useTable('Membros')
  const { data: pont } = useTable('Pontuacoes')
  
  // Buscar totais das tabelas mestras
  const { data: allReg } = useTable('Regiao')
  const { data: allDist } = useTable('Distritos')
  const { data: allIg } = useTable('Igrejas')

  // Calcular cobertura (quantos dos totais têm pelo menos 1 base)
  const usedReg   = new Set(bases.map(b => b.id_regiao).filter(Boolean)).size
  const usedDist  = new Set(bases.map(b => b.id_distritos).filter(Boolean)).size
  const usedIg    = new Set(bases.map(b => b.id_igrejas).filter(Boolean)).size

  const teen      = bases.filter(b => b.Tipo === 'G148 Teen').length
  const soul      = bases.filter(b => b.Tipo === 'Soul+').length

  const stats = [
    { num: bases.length,    label: 'Bases',      icon: '⛪', color: 'c1' },
    { num: membros.length,  label: 'Membros',    icon: '👥', color: 'c2' },
    { num: pont.length,     label: 'Pontuações', icon: '🏆', color: 'c3' },
    { num: `${usedReg}/${allReg.length}`,   label: 'Regiões (Cobertura)',   icon: '🗺️', color: 'c4' },
    { num: `${usedDist}/${allDist.length}`, label: 'Distritos (Cobertura)', icon: '📍', color: 'c5' },
    { num: `${usedIg}/${allIg.length}`,     label: 'Igrejas (Cobertura)',   icon: '🏛️', color: 'c1' },
  ]

  // Agrupa bases por região → distrito → igreja
  const tree = {}
  bases.forEach(b => {
    const r = b.Regiao    || 'Sem Região'
    const d = b.Distritos || 'Sem Distrito'
    const i = b.Igrejas   || 'Sem Igreja'
    if (!tree[r]) tree[r] = {}
    if (!tree[r][d]) tree[r][d] = {}
    if (!tree[r][d][i]) tree[r][d][i] = { teen: [], soul: [] }
    b.Tipo === 'Soul+'
      ? tree[r][d][i].soul.push(b.Base)
      : tree[r][d][i].teen.push(b.Base)
  })

  return (
    <div className="fade-in">
      {/* Banner de auditoria */}
      <div className="status-bar warn" style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <div>
          <div style={{ fontWeight: 800 }}>Modo Auditoria Ativo</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            O sistema está liberado para ajustes gerais. Após este período, funções sensíveis serão restritas ao administrador.
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className={`stat-card ${s.color}`}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-num">{s.num}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="form-grid-2">
        {/* Distribuição Teen / Soul+ */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📊 Distribuição por Tipo</div>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, padding: 16, background: 'rgba(124,58,237,0.1)', borderRadius: 12, textAlign: 'center', border: '1px solid rgba(124,58,237,0.2)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#C4B5FD' }}>{teen}</div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>G148 Teen</div>
            </div>
            <div style={{ flex: 1, padding: 16, background: 'rgba(255,212,59,0.1)', borderRadius: 12, textAlign: 'center', border: '1px solid rgba(255,212,59,0.2)' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#FFD43B' }}>{soul}</div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginTop: 4 }}>Soul+</div>
            </div>
          </div>
        </div>

        {/* Informações rápidas */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">ℹ️ Informações do Sistema</div>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Média Membros/Base:</span>
                <strong style={{ color: 'var(--text)' }}>
                  {bases.length ? (membros.length / bases.length).toFixed(1) : 0}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bases Ativas:</span>
                <strong style={{ color: 'var(--good)' }}>{bases.filter(b => b.Status === 'Ativo').length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Bases Inativas:</span>
                <strong style={{ color: 'var(--bad)' }}>{bases.filter(b => b.Status !== 'Ativo').length}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 24 }} />

      {/* Árvore geográfica */}
      {Object.keys(tree).length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🗺️ Mapa Geográfico de Bases</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(tree).sort(([a],[b]) => a.localeCompare(b)).map(([reg, dists]) => {
              const totalReg = Object.values(dists).flatMap(Object.values).reduce((acc, n) => acc + n.teen.length + n.soul.length, 0)
              return (
                <details key={reg} open className="geo-details">
                  <summary>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       🗺️ <strong>{reg}</strong>
                    </span>
                    <span className="nav-badge">{totalReg} bases</span>
                  </summary>
                  <div className="details-content">
                    {Object.entries(dists).sort(([a],[b]) => a.localeCompare(b)).map(([dist, igs]) => (
                      <details key={dist} style={{ marginLeft: 16, marginTop: 10 }}>
                        <summary style={{ fontSize: 13, fontWeight: 700, color: 'var(--c2)' }}>
                          📍 {dist}
                        </summary>
                        <div style={{ marginLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {Object.entries(igs).sort(([a],[b]) => a.localeCompare(b)).map(([ig, node]) => (
                            <div key={ig}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>🏛️ {ig}</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {node.teen.map(n => (
                                  <span key={n} className="chip chip-teen">⚓ {n}</span>
                                ))}
                                {node.soul.map(n => (
                                  <span key={n} className="chip chip-soul">⚓ {n}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}

      {bases.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">⛪</div>
            <p>Nenhuma base cadastrada ainda.<br />Os dados do Supabase aparecerão aqui.</p>
          </div>
        </div>
      )}
    </div>
  )
}

