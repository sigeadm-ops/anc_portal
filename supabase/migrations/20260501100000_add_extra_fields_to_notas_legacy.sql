-- ================================================================
-- Fix: adiciona discipulado, trezentos_treinamento, trezentos_estudo
--      às tabelas legadas Notas_Teen e Notas_Soul e recria as views
--      vw_notas_teen / vw_notas_soul para expor esses campos.
--
-- Raiz do problema: insertNotasForm tentava gravar essas colunas nas
-- tabelas legacy, mas elas não existiam. O mecanismo de retry as
-- removia silenciosamente antes de salvar, causando perda de dados.
-- ================================================================

-- 1. Adiciona colunas nas tabelas legacy (idempotente)
ALTER TABLE "Notas_Teen"
  ADD COLUMN IF NOT EXISTS discipulado           TEXT,
  ADD COLUMN IF NOT EXISTS trezentos_treinamento TEXT,
  ADD COLUMN IF NOT EXISTS trezentos_estudo      TEXT;

ALTER TABLE "Notas_Soul"
  ADD COLUMN IF NOT EXISTS discipulado           TEXT,
  ADD COLUMN IF NOT EXISTS trezentos_treinamento TEXT,
  ADD COLUMN IF NOT EXISTS trezentos_estudo      TEXT;

-- 2. Recria vw_notas_teen referenciando as colunas reais
DROP VIEW IF EXISTS vw_notas_teen;
CREATE OR REPLACE VIEW vw_notas_teen AS
SELECT
  vn.*,
  t.discipulado,
  t.trezentos_treinamento,
  t.trezentos_estudo
FROM (
  SELECT * FROM vw_notas
  WHERE tipo = 'G148 Teen'
     OR UPPER(COALESCE(aba, '')) IN ('NOTAS', 'NOTAS_TEEN')
) vn
LEFT JOIN "Notas_Teen" t ON t.id = vn.id;

-- 3. Recria vw_notas_soul referenciando as colunas reais
DROP VIEW IF EXISTS vw_notas_soul;
CREATE OR REPLACE VIEW vw_notas_soul AS
SELECT
  vn.*,
  s.discipulado,
  s.trezentos_treinamento,
  s.trezentos_estudo
FROM (
  SELECT * FROM vw_notas
  WHERE tipo = 'Soul+'
     OR UPPER(COALESCE(aba, '')) = 'NOTAS_SOUL'
) vn
LEFT JOIN "Notas_Soul" s ON s.id = vn.id;

-- 4. Restaura permissões
GRANT SELECT ON vw_notas_teen TO anon, authenticated;
GRANT SELECT ON vw_notas_soul TO anon, authenticated;
