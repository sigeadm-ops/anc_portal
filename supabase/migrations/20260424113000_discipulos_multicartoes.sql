-- ================================================================
-- Multi-cartao para discipulado (G148 e Soul+)
-- Cada membro pode ter varios cartoes com departamento/discipulado
-- e cada cartao possui progresso independente.
-- ================================================================

-- 1) Tabela de cartoes de discipulado
CREATE TABLE IF NOT EXISTS discipulos_cartoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id text NOT NULL,
  base_id text NOT NULL,
  ano int NOT NULL,
  tipo text NOT NULL DEFAULT 'G148 Teen',
  ordem int NOT NULL DEFAULT 1,
  nome text NOT NULL DEFAULT 'Cartao 1',
  departamento text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discipulos_cartoes_unique_ordem UNIQUE (membro_id, base_id, ano, tipo, ordem)
);

CREATE INDEX IF NOT EXISTS idx_discipulos_cartoes_base_ano_tipo ON discipulos_cartoes(base_id, ano, tipo);
CREATE INDEX IF NOT EXISTS idx_discipulos_cartoes_membro_ano ON discipulos_cartoes(membro_id, ano);

-- 2) Adiciona vinculo de cartao nos registros
ALTER TABLE discipulos_registros
  ADD COLUMN IF NOT EXISTS card_id uuid;

-- 3) Backfill de cartao padrao para dados existentes (G148 Teen)
INSERT INTO discipulos_cartoes (membro_id, base_id, ano, tipo, ordem, nome, departamento)
SELECT
  src.membro_id,
  src.base_id,
  src.ano,
  'G148 Teen'::text,
  1,
  'Cartao 1',
  NULL
FROM (
  SELECT DISTINCT membro_id, base_id, ano
  FROM discipulos_registros
) src
ON CONFLICT (membro_id, base_id, ano, tipo, ordem) DO NOTHING;

UPDATE discipulos_registros dr
SET card_id = dc.id
FROM discipulos_cartoes dc
WHERE dr.card_id IS NULL
  AND dc.membro_id = dr.membro_id
  AND dc.base_id = dr.base_id
  AND dc.ano = dr.ano
  AND dc.tipo = 'G148 Teen'
  AND dc.ordem = 1;

-- 4) Constraint nova de unicidade por cartao
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'discipulos_registros_membro_id_requisito_id_ano_key'
  ) THEN
    ALTER TABLE discipulos_registros
      DROP CONSTRAINT discipulos_registros_membro_id_requisito_id_ano_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'discipulos_registros_membro_req_ano_card_key'
  ) THEN
    ALTER TABLE discipulos_registros
      ADD CONSTRAINT discipulos_registros_membro_req_ano_card_key
      UNIQUE (membro_id, requisito_id, ano, card_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'discipulos_registros_card_id_fkey'
  ) THEN
    ALTER TABLE discipulos_registros
      ADD CONSTRAINT discipulos_registros_card_id_fkey
      FOREIGN KEY (card_id)
      REFERENCES discipulos_cartoes(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_discipulos_registros_card ON discipulos_registros(card_id, ano);

-- 5) NOT NULL em card_id (apos backfill)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM discipulos_registros WHERE card_id IS NULL) THEN
    RAISE NOTICE 'Existem registros sem card_id; ajuste manual antes de tornar NOT NULL.';
  ELSE
    ALTER TABLE discipulos_registros
      ALTER COLUMN card_id SET NOT NULL;
  END IF;
END $$;

-- 6) Trigger para atualizado_em
CREATE OR REPLACE FUNCTION set_updated_at_discipulos_cartoes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_discipulos_cartoes_updated_at ON discipulos_cartoes;
CREATE TRIGGER trg_discipulos_cartoes_updated_at
BEFORE UPDATE ON discipulos_cartoes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_discipulos_cartoes();

-- 7) RLS permissivo (padrao atual do projeto)
ALTER TABLE discipulos_cartoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'discipulos_cartoes' AND policyname = 'select_all'
  ) THEN
    CREATE POLICY "select_all" ON discipulos_cartoes FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'discipulos_cartoes' AND policyname = 'write_all'
  ) THEN
    CREATE POLICY "write_all" ON discipulos_cartoes FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON discipulos_cartoes TO anon, authenticated;
