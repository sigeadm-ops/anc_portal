-- ================================================================
-- Fix: adiciona discipulado, trezentos_treinamento, trezentos_estudo
--      às views vw_notas_teen e vw_notas_soul via LEFT JOIN nas
--      tabelas-fonte Notas_Teen / Notas_Soul.
--
-- Essas colunas existem nas tabelas legacy mas não foram incluídas
-- no UNION de vw_notas (sync_compat_views), tornando-as invisíveis
-- nos relatórios de notas.
--
-- Estratégia:
--   • Recriar vw_notas_teen como: filtragem de vw_notas + LEFT JOIN
--     em "Notas_Teen" (quando existir) para buscar os campos extras.
--   • Idem para vw_notas_soul.
--   • Se as colunas não existirem nas tabelas legacy, expõe NULL.
--   • Compatível com esquema normalizado (notas) — o LEFT JOIN retorna
--     NULL para linhas oriundas da tabela notas (não há id duplicado).
-- ================================================================

DROP VIEW IF EXISTS vw_notas_teen;
DROP VIEW IF EXISTS vw_notas_soul;

DO $$
DECLARE
  v_has_teen        boolean;
  v_has_soul        boolean;

  -- Notas_Teen column checks
  v_teen_disc       boolean;
  v_teen_trez_tr    boolean;
  v_teen_trez_est   boolean;
  v_teen_discipulo  boolean;   -- coluna alternativa normalizada

  -- Notas_Soul column checks
  v_soul_disc       boolean;
  v_soul_trez_tr    boolean;
  v_soul_trez_est   boolean;

  -- Expressões dinâmicas para discipulado
  teen_disc_expr    text;
  soul_disc_expr    text;

  -- Expressões dinâmicas para trezentos
  teen_trez_tr_expr  text;
  teen_trez_est_expr text;
  soul_trez_tr_expr  text;
  soul_trez_est_expr text;

BEGIN
  -- ── Verifica existência das tabelas ──────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Notas_Teen'
  ) INTO v_has_teen;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Notas_Soul'
  ) INTO v_has_soul;

  -- ── Verifica colunas em Notas_Teen ───────────────────────────
  IF v_has_teen THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Teen'
        AND column_name = 'discipulado') INTO v_teen_disc;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Teen'
        AND column_name = 'discipulo') INTO v_teen_discipulo;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Teen'
        AND column_name = 'trezentos_treinamento') INTO v_teen_trez_tr;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Teen'
        AND column_name = 'trezentos_estudo') INTO v_teen_trez_est;

    -- Monta expressão para discipulado (prefere discipulado, fallback discipulo, fallback NULL)
    IF v_teen_disc THEN
      teen_disc_expr := 'COALESCE(t.discipulado, NULL::text)';
    ELSIF v_teen_discipulo THEN
      teen_disc_expr := 'COALESCE(t.discipulo, NULL::text)';
    ELSE
      teen_disc_expr := 'NULL::text';
    END IF;

    teen_trez_tr_expr  := CASE WHEN v_teen_trez_tr  THEN 't.trezentos_treinamento' ELSE 'NULL::text' END;
    teen_trez_est_expr := CASE WHEN v_teen_trez_est THEN 't.trezentos_estudo'      ELSE 'NULL::text' END;

    EXECUTE format($Q$
      CREATE OR REPLACE VIEW vw_notas_teen AS
      SELECT
        vn.*,
        %s AS discipulado,
        %s AS trezentos_treinamento,
        %s AS trezentos_estudo
      FROM (
        SELECT * FROM vw_notas
        WHERE tipo = 'G148 Teen'
           OR UPPER(COALESCE(aba, '')) IN ('NOTAS', 'NOTAS_TEEN')
      ) vn
      LEFT JOIN "Notas_Teen" t ON t.id = vn.id
    $Q$, teen_disc_expr, teen_trez_tr_expr, teen_trez_est_expr);

  ELSE
    -- Sem tabela Notas_Teen — apenas filtra vw_notas com NULLs
    CREATE OR REPLACE VIEW vw_notas_teen AS
    SELECT
      vn.*,
      NULL::text AS discipulado,
      NULL::text AS trezentos_treinamento,
      NULL::text AS trezentos_estudo
    FROM (
      SELECT * FROM vw_notas
      WHERE tipo = 'G148 Teen'
         OR UPPER(COALESCE(aba, '')) IN ('NOTAS', 'NOTAS_TEEN')
    ) vn;
  END IF;

  -- ── Verifica colunas em Notas_Soul ───────────────────────────
  IF v_has_soul THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Soul'
        AND column_name = 'discipulado') INTO v_soul_disc;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Soul'
        AND column_name = 'trezentos_treinamento') INTO v_soul_trez_tr;

    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Notas_Soul'
        AND column_name = 'trezentos_estudo') INTO v_soul_trez_est;

    soul_disc_expr    := CASE WHEN v_soul_disc    THEN 's.discipulado'          ELSE 'NULL::text' END;
    soul_trez_tr_expr := CASE WHEN v_soul_trez_tr THEN 's.trezentos_treinamento' ELSE 'NULL::text' END;
    soul_trez_est_expr:= CASE WHEN v_soul_trez_est THEN 's.trezentos_estudo'     ELSE 'NULL::text' END;

    EXECUTE format($Q$
      CREATE OR REPLACE VIEW vw_notas_soul AS
      SELECT
        vn.*,
        %s AS discipulado,
        %s AS trezentos_treinamento,
        %s AS trezentos_estudo
      FROM (
        SELECT * FROM vw_notas
        WHERE tipo = 'Soul+'
           OR UPPER(COALESCE(aba, '')) = 'NOTAS_SOUL'
      ) vn
      LEFT JOIN "Notas_Soul" s ON s.id = vn.id
    $Q$, soul_disc_expr, soul_trez_tr_expr, soul_trez_est_expr);

  ELSE
    CREATE OR REPLACE VIEW vw_notas_soul AS
    SELECT
      vn.*,
      NULL::text AS discipulado,
      NULL::text AS trezentos_treinamento,
      NULL::text AS trezentos_estudo
    FROM (
      SELECT * FROM vw_notas
      WHERE tipo = 'Soul+'
         OR UPPER(COALESCE(aba, '')) = 'NOTAS_SOUL'
    ) vn;
  END IF;

END $$;

-- ── Garante acesso às novas views ────────────────────────────
GRANT SELECT ON vw_notas_teen TO anon, authenticated;
GRANT SELECT ON vw_notas_soul TO anon, authenticated;
