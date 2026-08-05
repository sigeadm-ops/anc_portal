import { useEffect, useRef, useState } from 'react'

// Modal de exclusão em cascata (Base/Membro) — deliberadamente "escandaloso":
// existe pra ninguém apagar uma base/membro com dados vinculados sem antes
// ver exatamente o que vai junto e confirmar duas vezes, a segunda digitando
// o nome exato. Ver src/api/db.js (getDependenciasBase/Membro,
// excluirBaseCascata/MembroCascata) — a varredura roda de trás pra frente
// (notas/cartões/registros primeiro, o registro principal por último) pra
// nunca deixar dado órfão.
export default function ConfirmCascadeDeleteModal({
  open,
  tipoLabel,      // 'base' | 'membro'
  nome,
  dependencias,   // { chave: quantidade }
  labels,         // { chave: 'descrição legível' }
  onCancel,
  onConfirm,      // async () => void
}) {
  const [step, setStep] = useState('review')
  const [digitado, setDigitado] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)

  const itens = Object.entries(dependencias || {}).filter(([, qtd]) => qtd > 0)
  const hasDeps = itens.length > 0
  const nomeConfere = digitado.trim() === String(nome ?? '').trim()

  useEffect(() => {
    if (!open) return
    setStep('review')
    setDigitado('')
    setIsDeleting(false)
    setShake(false)
  }, [open])

  useEffect(() => {
    if (step === 'type-confirm' && inputRef.current) inputRef.current.focus()
  }, [step])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape' && !isDeleting) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, isDeleting, onCancel])

  if (!open) return null

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  async function handleConfirmar() {
    if (hasDeps && !nomeConfere) {
      triggerShake()
      return
    }
    setIsDeleting(true)
    try {
      await onConfirm()
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="danger-modal-backdrop" onClick={() => !isDeleting && onCancel()}>
      <div className={`danger-modal${shake ? ' shake' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="danger-modal-header">
          <div className="danger-icon-container">⚠️</div>
          <div className="danger-modal-title">Exclusão permanente de {tipoLabel}</div>
          <div className="danger-modal-subtitle">
            Esta ação não pode ser desfeita. Revise com atenção antes de continuar.
          </div>
        </div>

        <div className="danger-modal-body">
          <div className="danger-modal-name">"{nome}"</div>

          {hasDeps ? (
            <>
              <ul className="danger-dep-list">
                {itens.map(([chave, qtd]) => (
                  <li key={chave} className="danger-dep-item">
                    <span>{labels[chave] || chave}</span>
                    <strong>{qtd}</strong>
                  </li>
                ))}
              </ul>
              <div className="danger-modal-warning">
                🚨 Tudo isso será apagado PERMANENTEMENTE junto com {tipoLabel === 'base' ? 'a base' : 'o membro'}. Não há como recuperar depois.
              </div>

              {step === 'type-confirm' && (
                <>
                  <div className="danger-modal-confirm-label">
                    Para confirmar, digite exatamente o nome {tipoLabel === 'base' ? 'da base' : 'do membro'} abaixo:
                  </div>
                  <input
                    ref={inputRef}
                    id="danger-confirm-input"
                    className={`danger-modal-confirm-input${nomeConfere ? ' match' : ''}`}
                    value={digitado}
                    onChange={(e) => setDigitado(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmar()}
                    placeholder={nome}
                    disabled={isDeleting}
                    autoComplete="off"
                  />
                </>
              )}
            </>
          ) : (
            <div className="danger-modal-warning">
              Nenhum dado vinculado encontrado — nada além d{tipoLabel === 'base' ? 'a própria base' : 'o próprio membro'} será apagado.
            </div>
          )}
        </div>

        <div className="danger-modal-footer">
          <button className="danger-btn-cancel" onClick={onCancel} disabled={isDeleting}>
            Cancelar
          </button>

          {hasDeps && step === 'review' && (
            <button className="danger-btn-confirm" onClick={() => setStep('type-confirm')}>
              Sim, quero excluir
            </button>
          )}

          {(!hasDeps || step === 'type-confirm') && (
            <button
              className="danger-btn-confirm"
              onClick={handleConfirmar}
              disabled={isDeleting || (hasDeps && !nomeConfere)}
            >
              {isDeleting ? <><span className="spinner" /> Excluindo…</> : '🗑️ Excluir permanentemente'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
