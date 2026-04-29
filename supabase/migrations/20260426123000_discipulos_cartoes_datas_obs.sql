-- ============================================================
-- Migração: vigência e observações nos cartões de discipulado
-- Objetivo: validar discipulado nas notas apenas com cartão salvo
-- ============================================================

ALTER TABLE discipulos_cartoes
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim date,
  ADD COLUMN IF NOT EXISTS observacoes_professor text;

CREATE INDEX IF NOT EXISTS idx_discipulos_cartoes_vigencia
  ON discipulos_cartoes(membro_id, base_id, ano, tipo, data_inicio, data_fim);
