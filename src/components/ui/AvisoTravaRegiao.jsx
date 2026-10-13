import { mensagemTravaRegiao } from '../../lib/travaRegiao'

// Aviso mostrado nas telas públicas quando a base escolhida é de uma região
// com os lançamentos travados (hooks/useTravaRegiao.js).
export default function AvisoTravaRegiao({ regiao, style }) {
  if (!regiao) return null
  return (
    <div className="card" style={{
      padding: '14px 20px', marginBottom: 16,
      background: 'rgba(255,180,0,.08)', borderColor: 'var(--warn)',
      display: 'flex', alignItems: 'center', gap: 12,
      ...style,
    }}>
      <span style={{ fontSize: 20 }}>🔒</span>
      <div>
        <strong style={{ color: 'var(--warn)' }}>Lançamentos da região {regiao} travados</strong>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {mensagemTravaRegiao(regiao)} Os dados continuam disponíveis para consulta.
        </div>
      </div>
    </div>
  )
}
