-- ================================================================
-- Discípulos: adiciona foto_url ao cartão e cria tabela de config
-- de pontos por cartão (substitui o sistema de requisitos)
-- ================================================================

-- 1) Coluna foto_url em discipulos_cartoes
ALTER TABLE discipulos_cartoes
  ADD COLUMN IF NOT EXISTS foto_url text;

-- 2) Tabela de configuração de pontos por cartão
CREATE TABLE IF NOT EXISTS discipulos_config (
  id int PRIMARY KEY DEFAULT 1,
  pontos_por_cartao numeric(8,2) NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Garante que só existe a linha id=1
INSERT INTO discipulos_config (id, pontos_por_cartao)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE discipulos_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'discipulos_config' AND policyname = 'select_all'
  ) THEN
    CREATE POLICY "select_all" ON discipulos_config FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'discipulos_config' AND policyname = 'write_all'
  ) THEN
    CREATE POLICY "write_all" ON discipulos_config FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
