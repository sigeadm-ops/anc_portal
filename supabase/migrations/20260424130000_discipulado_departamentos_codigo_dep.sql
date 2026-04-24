-- ================================================================
-- Codigo automatico Dep01, Dep02... para departamentos do discipulado
-- ================================================================

ALTER TABLE discipulado_departamentos_catalogo
  ADD COLUMN IF NOT EXISTS codigo text;

-- Backfill para registros existentes (ordenado alfabeticamente)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY nome ASC, criado_em ASC) AS rn
  FROM discipulado_departamentos_catalogo
)
UPDATE discipulado_departamentos_catalogo d
SET codigo = 'Dep' || LPAD(ordered.rn::text, 2, '0')
FROM ordered
WHERE d.id = ordered.id
  AND (d.codigo IS NULL OR d.codigo = '');

-- Garante unicidade
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'discipulado_departamentos_catalogo_codigo_key'
  ) THEN
    ALTER TABLE discipulado_departamentos_catalogo
      ADD CONSTRAINT discipulado_departamentos_catalogo_codigo_key UNIQUE (codigo);
  END IF;
END $$;

-- Gera codigo automaticamente em novos inserts
CREATE OR REPLACE FUNCTION set_codigo_discipulado_departamento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_num int;
BEGIN
  IF NEW.codigo IS NOT NULL AND NEW.codigo <> '' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 4) AS int)), 0) + 1
    INTO next_num
  FROM discipulado_departamentos_catalogo
  WHERE codigo ~ '^Dep[0-9]+$';

  NEW.codigo := 'Dep' || LPAD(next_num::text, 2, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_codigo_discipulado_departamento ON discipulado_departamentos_catalogo;
CREATE TRIGGER trg_set_codigo_discipulado_departamento
BEFORE INSERT ON discipulado_departamentos_catalogo
FOR EACH ROW
EXECUTE FUNCTION set_codigo_discipulado_departamento();
