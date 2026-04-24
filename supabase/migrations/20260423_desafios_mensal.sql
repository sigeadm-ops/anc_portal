-- ============================================================
-- Migração: Suporte a desafios mensais (Calebe, 10 Dias, etc.)
-- ============================================================

-- 1. Adicionar 'mensal' como opção de periodicidade no catálogo
ALTER TABLE desafios_catalogo
  DROP CONSTRAINT IF EXISTS desafios_catalogo_periodicidade_check;
ALTER TABLE desafios_catalogo
  ADD CONSTRAINT desafios_catalogo_periodicidade_check
  CHECK (periodicidade IN ('trimestral', 'anual', 'mensal'));

-- 2. Coluna mes em desafios_marcos (mês dentro do trimestre: 1-12)
ALTER TABLE desafios_marcos
  ADD COLUMN IF NOT EXISTS mes smallint CHECK (mes BETWEEN 1 AND 12);

-- 3. Recriar índice de trimestral para excluir mensais (mes IS NULL)
DROP INDEX IF EXISTS idx_marcos_unique_trim;
CREATE UNIQUE INDEX IF NOT EXISTS idx_marcos_unique_trim
  ON desafios_marcos(base_id, desafio_id, ano, trimestre)
  WHERE trimestre IS NOT NULL AND mes IS NULL;

-- 4. Índice para mensais: único por (base, desafio, ano, trimestre, mes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_marcos_unique_mensal
  ON desafios_marcos(base_id, desafio_id, ano, trimestre, mes)
  WHERE mes IS NOT NULL;
