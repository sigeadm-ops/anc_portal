-- ============================================================
-- Migração: Data de ocorrência para catálogo de desafios
-- Objetivo: permitir ordenação cronológica e posição automática
-- ============================================================

ALTER TABLE desafios_catalogo
  ADD COLUMN IF NOT EXISTS data_ocorrencia date;

CREATE INDEX IF NOT EXISTS idx_desafios_catalogo_data_ocorrencia
  ON desafios_catalogo(data_ocorrencia, ordem, nome);
