-- ============================================================
-- Migração: campo descrição nos cartões de discipulado
-- ============================================================

ALTER TABLE discipulos_cartoes
  ADD COLUMN IF NOT EXISTS descricao text;
