-- ================================================================
-- ANC App — Automação de IDs (Sequências e Defaults)
-- Data: 2026-04-14
--
-- Script IDEMPOTENTE: pode ser executado múltiplas vezes com segurança.
-- Cria sequências independentes e configura DEFAULT em cada tabela para
-- que novos registros recebam IDs formatados automaticamente.
--
-- Padrões:
--   regioes    → R01, R02...  (cresce: R100, R101...)
--   distritos  → D01, D02...  (cresce: D100, D101...)
--   igrejas    → I001, I002...
--   provas     → PG01... (Teen) / PS01... (Soul+) — sequências independentes via TRIGGER
--
-- Nota: no schema atual, bases e membros usam UUID como PK.
-- ================================================================

-- ── FUNÇÃO AUXILIAR ──────────────────────────────────────────────
-- Formata um ID legível: prefixo + número com zero-padding mínimo.
-- O padding cresce automaticamente se val ultrapassar pad_len dígitos.
-- Ex: format_custom_id('R', 9, 2) → 'R09'
--     format_custom_id('R', 100, 2) → 'R100'   (sem truncar!)
CREATE OR REPLACE FUNCTION format_custom_id(prefix text, val bigint, pad_len int)
RETURNS text AS $$
BEGIN
  RETURN prefix || lpad(val::text, GREATEST(pad_len, length(val::text)), '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ── 1. REGIOES (R01, R02...) ─────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS regioes_id_seq;
DO $$
DECLARE next_val int := 1;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Regiao') THEN
    SELECT COALESCE(MAX(SUBSTRING(id_regiao FROM '[0-9]+')::int), 0) + 1
      INTO next_val FROM "Regiao" WHERE id_regiao ~ '^R[0-9]+$';
    EXECUTE 'ALTER TABLE "Regiao" ALTER COLUMN id_regiao SET DEFAULT format_custom_id(''R'', nextval(''regioes_id_seq''), 2)';
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'regioes') THEN
    SELECT COALESCE(MAX(SUBSTRING(id FROM '[0-9]+')::int), 0) + 1
      INTO next_val FROM regioes WHERE id ~ '^R[0-9]+$';
    EXECUTE 'ALTER TABLE regioes ALTER COLUMN id SET DEFAULT format_custom_id(''R'', nextval(''regioes_id_seq''), 2)';
  END IF;
  PERFORM setval('regioes_id_seq', GREATEST(next_val, 1), false);
END $$;


-- ── 2. DISTRITOS (D01, D02...) ───────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS distritos_id_seq;
DO $$
DECLARE next_val int := 1;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Distritos') THEN
    SELECT COALESCE(MAX(SUBSTRING(id_distritos FROM '[0-9]+')::int), 0) + 1
      INTO next_val FROM "Distritos" WHERE id_distritos ~ '^D[0-9]+$';
    EXECUTE 'ALTER TABLE "Distritos" ALTER COLUMN id_distritos SET DEFAULT format_custom_id(''D'', nextval(''distritos_id_seq''), 2)';
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'distritos') THEN
    SELECT COALESCE(MAX(SUBSTRING(id FROM '[0-9]+')::int), 0) + 1
      INTO next_val FROM distritos WHERE id ~ '^D[0-9]+$';
    EXECUTE 'ALTER TABLE distritos ALTER COLUMN id SET DEFAULT format_custom_id(''D'', nextval(''distritos_id_seq''), 2)';
  END IF;
  PERFORM setval('distritos_id_seq', GREATEST(next_val, 1), false);
END $$;


-- ── 3. IGREJAS (I001, I002...) ───────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS igrejas_id_seq;
DO $$
DECLARE next_val int := 1;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Igrejas') THEN
    SELECT COALESCE(MAX(SUBSTRING(id_igrejas FROM '[0-9]+')::int), 0) + 1
      INTO next_val FROM "Igrejas" WHERE id_igrejas ~ '^I[0-9]+$';
    EXECUTE 'ALTER TABLE "Igrejas" ALTER COLUMN id_igrejas SET DEFAULT format_custom_id(''I'', nextval(''igrejas_id_seq''), 3)';
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'igrejas') THEN
    SELECT COALESCE(MAX(SUBSTRING(id FROM '[0-9]+')::int), 0) + 1
      INTO next_val FROM igrejas WHERE id ~ '^I[0-9]+$';
    EXECUTE 'ALTER TABLE igrejas ALTER COLUMN id SET DEFAULT format_custom_id(''I'', nextval(''igrejas_id_seq''), 3)';
  END IF;
  PERFORM setval('igrejas_id_seq', GREATEST(next_val, 1), false);
END $$;


-- ── 4. PROVAS (PG01... Teen / PS01... Soul+) ─────────────────────
-- Nota: DEFAULT de coluna não pode referenciar outras colunas do mesmo row.
-- Solução: TRIGGER BEFORE INSERT que gera o ID conforme o campo 'tipo'.

CREATE SEQUENCE IF NOT EXISTS provas_pg_id_seq;
DO $$
DECLARE next_val int := 1;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Provas') THEN
    SELECT COALESCE(MAX(SUBSTRING(id_provas FROM '[0-9]+')::int), 0) + 1
      INTO next_val FROM "Provas" WHERE id_provas ~ '^PG[0-9]+$';
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provas') THEN
    SELECT COALESCE(MAX(SUBSTRING(id FROM '[0-9]+')::int), 0) + 1
      INTO next_val FROM provas WHERE id ~ '^PG[0-9]+$';
  END IF;
  PERFORM setval('provas_pg_id_seq', GREATEST(next_val, 1), false);
END $$;

CREATE SEQUENCE IF NOT EXISTS provas_ps_id_seq;
DO $$
DECLARE next_val int := 1;
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Provas') THEN
    SELECT COALESCE(MAX(SUBSTRING(id_provas FROM '[0-9]+')::int), 0) + 1
      INTO next_val FROM "Provas" WHERE id_provas ~ '^PS[0-9]+$';
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provas') THEN
    SELECT COALESCE(MAX(SUBSTRING(id FROM '[0-9]+')::int), 0) + 1
      INTO next_val FROM provas WHERE id ~ '^PS[0-9]+$';
  END IF;
  PERFORM setval('provas_ps_id_seq', GREATEST(next_val, 1), false);
END $$;

-- Função auxiliar: escolhe a sequência correta pelo tipo da prova
CREATE OR REPLACE FUNCTION generate_prova_id(tipo_prova text)
RETURNS text AS $$
BEGIN
  IF tipo_prova = 'G148 Teen' THEN
    RETURN format_custom_id('PG', nextval('provas_pg_id_seq'), 2);
  ELSE
    RETURN format_custom_id('PS', nextval('provas_ps_id_seq'), 2);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: gera o id automaticamente se não fornecido
CREATE OR REPLACE FUNCTION trg_provas_id_gen()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'Provas' THEN
    IF NEW.id_provas IS NULL OR NEW.id_provas = '' THEN
      NEW.id_provas := generate_prova_id(NEW.tipo);
    END IF;
  ELSE
    IF NEW.id IS NULL OR NEW.id = '' THEN
      NEW.id := generate_prova_id(NEW.tipo);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Provas') THEN
    DROP TRIGGER IF EXISTS trg_provas_id_insert ON "Provas";
    CREATE TRIGGER trg_provas_id_insert
      BEFORE INSERT ON "Provas"
      FOR EACH ROW EXECUTE FUNCTION trg_provas_id_gen();
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provas') THEN
    DROP TRIGGER IF EXISTS trg_provas_id_insert ON provas;
    CREATE TRIGGER trg_provas_id_insert
      BEFORE INSERT ON provas
      FOR EACH ROW EXECUTE FUNCTION trg_provas_id_gen();
  END IF;
END $$;


-- ── 5. BASES e MEMBROS (UUID no schema atual) ───────────────────
-- Mantidos sem alteração: IDs são UUID por desenho do modelo.


-- ── 6. PERMISSÕES PARA IDs AUTOMÁTICOS ───────────────────────────
-- Em inserts via API pública (anon/authenticated), nextval exige uso da sequência.
GRANT USAGE, SELECT ON SEQUENCE regioes_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE distritos_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE igrejas_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE provas_pg_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE provas_ps_id_seq TO anon, authenticated;

-- Garante privilégios explícitos nas tabelas afetadas por defaults/triggers.
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Regiao') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE "Regiao" TO anon, authenticated;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'regioes') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE regioes TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Distritos') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE "Distritos" TO anon, authenticated;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'distritos') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE distritos TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Igrejas') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE "Igrejas" TO anon, authenticated;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'igrejas') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE igrejas TO anon, authenticated;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Provas') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE "Provas" TO anon, authenticated;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'provas') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE provas TO anon, authenticated;
  END IF;
END $$;
