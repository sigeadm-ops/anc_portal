-- ================================================================
-- ANC App — Adicionar coluna Verso nas tabelas de notas
-- Data: 2026-04-14
--
-- Objetivo:
-- 1) Garantir coluna Verso em Notas_Teen e Notas_Soul (schema legado)
-- 2) Garantir coluna verso em notas (schema normalizado)
--
-- Script IDEMPOTENTE e compatível com os dois modelos de schema.
-- ================================================================

DO $$
BEGIN
  -- --------------------------------------------------------------
  -- LEGADO: Notas_Teen
  -- --------------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Notas_Teen'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Teen' AND column_name = 'Verso'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Teen' AND column_name = 'verso'
    ) THEN
      ALTER TABLE "Notas_Teen" ADD COLUMN "Verso" text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'Notas_Teen'
        AND c.conname = 'notas_teen_verso_check'
    ) THEN
      ALTER TABLE "Notas_Teen"
        ADD CONSTRAINT notas_teen_verso_check CHECK ("Verso" IS NULL OR "Verso" IN ('Sim', 'Não'));
    END IF;
  END IF;

  -- --------------------------------------------------------------
  -- LEGADO: Notas_Soul
  -- --------------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Notas_Soul'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Soul' AND column_name = 'Verso'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Soul' AND column_name = 'verso'
    ) THEN
      ALTER TABLE "Notas_Soul" ADD COLUMN "Verso" text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'Notas_Soul'
        AND c.conname = 'notas_soul_verso_check'
    ) THEN
      ALTER TABLE "Notas_Soul"
        ADD CONSTRAINT notas_soul_verso_check CHECK ("Verso" IS NULL OR "Verso" IN ('Sim', 'Não'));
    END IF;
  END IF;

  -- --------------------------------------------------------------
  -- NORMALIZADO: notas
  -- --------------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notas'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notas' AND column_name = 'verso'
    ) THEN
      ALTER TABLE notas ADD COLUMN verso text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'notas'
        AND c.conname = 'notas_verso_check'
    ) THEN
      ALTER TABLE notas
        ADD CONSTRAINT notas_verso_check CHECK (verso IS NULL OR verso IN ('Sim', 'Não'));
    END IF;
  END IF;
END $$;

-- --------------------------------------------------------------
-- Permissões de escrita/leitura para API pública
-- --------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Notas_Teen') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE "Notas_Teen" TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Notas_Soul') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE "Notas_Soul" TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notas') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE notas TO anon, authenticated;
  END IF;
END $$;
