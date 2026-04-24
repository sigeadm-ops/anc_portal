-- ================================================================
-- Catalogo de departamentos do discipulado (G148 e Soul+)
-- Usado para sugerir/selecionar o departamento em cada cartao.
-- ================================================================

CREATE TABLE IF NOT EXISTS discipulado_departamentos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE,
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 99,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discipulado_departamentos_ativo_ordem
  ON discipulado_departamentos_catalogo(ativo, ordem, nome);

INSERT INTO discipulado_departamentos_catalogo (codigo, nome, ordem)
VALUES
  ('Dep01', 'Música', 1),
  ('Dep02', 'Mídia', 2),
  ('Dep03', 'Recepção', 3),
  ('Dep04', 'Infantil', 4),
  ('Dep05', 'Sonoplastia', 5),
  ('Dep06', 'Ação Solidária', 6),
  ('Dep07', 'Evangelismo', 7),
  ('Dep08', 'Escola Sabatina', 8),
  ('Dep09', 'Mordomia', 9),
  ('Dep10', 'Desbravadores', 10),
  ('Dep11', 'Aventureiros', 11)
ON CONFLICT (nome) DO NOTHING;

CREATE OR REPLACE FUNCTION set_updated_at_discipulado_departamentos_catalogo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_discipulado_departamentos_updated_at ON discipulado_departamentos_catalogo;
CREATE TRIGGER trg_discipulado_departamentos_updated_at
BEFORE UPDATE ON discipulado_departamentos_catalogo
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_discipulado_departamentos_catalogo();

ALTER TABLE discipulado_departamentos_catalogo ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'discipulado_departamentos_catalogo' AND policyname = 'select_all'
  ) THEN
    CREATE POLICY "select_all" ON discipulado_departamentos_catalogo FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'discipulado_departamentos_catalogo' AND policyname = 'write_all'
  ) THEN
    CREATE POLICY "write_all" ON discipulado_departamentos_catalogo FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON discipulado_departamentos_catalogo TO anon, authenticated;
