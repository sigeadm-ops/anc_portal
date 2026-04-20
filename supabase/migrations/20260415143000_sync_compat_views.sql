-- ================================================================
-- ANC App - Sync compat views for current frontend contract
-- Date: 2026-04-15
--
-- Goal:
-- 1) Keep vw_bases and vw_membros with legacy + modern aliases
-- 2) Keep vw_notas compatible for both normalized (notas) and
--    legacy (Notas_Teen / Notas_Soul) schemas
-- 3) Keep filtered views vw_notas_teen and vw_notas_soul
--
-- Idempotent migration.
-- ================================================================

-- ----------------------------------------------------------------
-- 0) Reset compatibility views (avoids column-signature conflicts)
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS vw_notas_teen;
DROP VIEW IF EXISTS vw_notas_soul;
DROP VIEW IF EXISTS vw_notas;
DROP VIEW IF EXISTS vw_membros;
DROP VIEW IF EXISTS vw_bases;

-- ----------------------------------------------------------------
-- 1) Bases compatibility view
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_bases_created_col text;
  v_bases_created_expr text;
BEGIN
  -- 1.1 normalized schema: bases/igrejas/distritos/regioes
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bases'
  ) THEN
    EXECUTE $SQL$
      CREATE OR REPLACE VIEW vw_bases AS
      SELECT
        b.id                                   AS id_base,
        b.id,
        b.cod_origem,
        b.tipo                                 AS "Tipo",
        b.tipo,
        b.nome                                 AS "Base",
        b.nome                                 AS base,
        b.status                               AS "Status",
        b.status,
        b.data_cad                             AS "Data_Cad",
        b.data_cad,
        b.created_at                           AS "CreatedAt",
        b.created_at,
        b.updated_at,

        b.igreja_id                            AS id_igrejas,
        b.igreja_id                            AS igreja_id,
        i.nome                                 AS "Igreja_Nome",
        i.nome                                 AS "Igrejas",
        i.nome                                 AS igreja,

        i.distrito_id                          AS id_distritos,
        i.distrito_id                          AS distrito_id,
        d.nome                                 AS "Distrito_Nome",
        d.nome                                 AS "Distritos",
        d.nome                                 AS distrito,

        d.regiao_id                            AS id_regiao,
        d.regiao_id                            AS regiao_id,
        r.nome                                 AS "Regiao_Nome",
        r.nome                                 AS "Regiao",
        r.nome                                 AS regiao,

        b.coord                                AS "Coord",
        b.coord,
        b.coord_fone                           AS "Coord_Fone",
        b.coord_fone,
        b.coord_email                          AS "Coord_Email",
        b.coord_email,
        b.prof                                 AS "Prof",
        b.prof,
        b.prof_fone                            AS "Prof_Fone",
        b.prof_fone,
        b.prof_email                           AS "Prof_Email",
        b.prof_email,
        b.midia                                AS "Midia",
        b.midia,
        b.midia_fone                           AS "Midia_Fone",
        b.midia_fone,
        b.midia_email                          AS "Midia_Email",
        b.midia_email
      FROM bases b
      LEFT JOIN igrejas i   ON i.id = b.igreja_id
      LEFT JOIN distritos d ON d.id = i.distrito_id
      LEFT JOIN regioes r   ON r.id = d.regiao_id
    $SQL$;

  -- 1.2 legacy schema: "Bases"/"Igrejas"/"Distritos"/"Regiao"
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Bases'
  ) THEN
    SELECT c.column_name
      INTO v_bases_created_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'Bases'
      AND c.column_name IN ('CreatedAt', 'CreateAt', 'created_at')
    ORDER BY CASE c.column_name
      WHEN 'CreatedAt' THEN 1
      WHEN 'CreateAt' THEN 2
      WHEN 'created_at' THEN 3
      ELSE 99
    END
    LIMIT 1;

    IF v_bases_created_col IS NULL THEN
      v_bases_created_expr := 'NULL::timestamptz';
    ELSE
      v_bases_created_expr := format('b.%I', v_bases_created_col);
    END IF;

    EXECUTE format($SQL$
      CREATE OR REPLACE VIEW vw_bases AS
      SELECT
        b.id_base                               AS id_base,
        b.id_base                               AS id,
        NULL::text                              AS cod_origem,
        b."Tipo"                               AS "Tipo",
        b."Tipo"                               AS tipo,
        b."Base"                               AS "Base",
        b."Base"                               AS base,
        b."Status"                             AS "Status",
        b."Status"                             AS status,
        b."Data_Cad"                           AS "Data_Cad",
        b."Data_Cad"                           AS data_cad,
        %s                                      AS "CreatedAt",
        %s                                      AS created_at,
        %s                                      AS updated_at,

        b.id_igrejas                            AS id_igrejas,
        b.id_igrejas                            AS igreja_id,
        i."Igrejas"                            AS "Igreja_Nome",
        i."Igrejas"                            AS "Igrejas",
        i."Igrejas"                            AS igreja,

        i.id_distritos                          AS id_distritos,
        i.id_distritos                          AS distrito_id,
        d."Distritos"                          AS "Distrito_Nome",
        d."Distritos"                          AS "Distritos",
        d."Distritos"                          AS distrito,

        d.id_regiao                             AS id_regiao,
        d.id_regiao                             AS regiao_id,
        r."Regiao"                             AS "Regiao_Nome",
        r."Regiao"                             AS "Regiao",
        r."Regiao"                             AS regiao,

        b."Coord"                              AS "Coord",
        b."Coord"                              AS coord,
        b."Coord_Fone"                         AS "Coord_Fone",
        b."Coord_Fone"                         AS coord_fone,
        b."Coord_Email"                        AS "Coord_Email",
        b."Coord_Email"                        AS coord_email,
        b."Prof"                               AS "Prof",
        b."Prof"                               AS prof,
        b."Prof_Fone"                          AS "Prof_Fone",
        b."Prof_Fone"                          AS prof_fone,
        b."Prof_Email"                         AS "Prof_Email",
        b."Prof_Email"                         AS prof_email,
        b."Midia"                              AS "Midia",
        b."Midia"                              AS midia,
        b."Midia_Fone"                         AS "Midia_Fone",
        b."Midia_Fone"                         AS midia_fone,
        b."Midia_Email"                        AS "Midia_Email",
        b."Midia_Email"                        AS midia_email
      FROM "Bases" b
      LEFT JOIN "Igrejas" i   ON i.id_igrejas = b.id_igrejas
      LEFT JOIN "Distritos" d ON d.id_distritos = i.id_distritos
      LEFT JOIN "Regiao" r    ON r.id_regiao = d.id_regiao
    $SQL$, v_bases_created_expr, v_bases_created_expr, v_bases_created_expr);

  ELSE
    RAISE NOTICE 'No bases source table found. vw_bases was not recreated.';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 2) Membros compatibility view
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_membros_created_col text;
  v_membros_created_expr text;
BEGIN
  -- 2.1 normalized schema
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'membros'
  ) THEN
    EXECUTE $SQL$
      CREATE OR REPLACE VIEW vw_membros AS
      SELECT
        m.id                                   AS id_membros,
        m.id,
        m.base_id                              AS id_base,
        m.base_id,
        m.nome                                 AS "Membros",
        m.nome,
        m.nasc                                 AS "Nasc",
        m.nasc,
        m.fone                                 AS "Fone",
        m.fone,
        m.email                                AS "Email",
        m.email,
        m.endereco                             AS "Endereco",
        m.endereco,
        m.responsavel                          AS "Responsavel",
        m.responsavel,
        m.cpf                                  AS "CPF",
        m.cpf,
        m.rg                                   AS "RG",
        m.rg,
        m.camiseta                             AS "Camiseta",
        m.camiseta,
        m.status                               AS "Status",
        m.status,
        m.data_cad                             AS "DataCad",
        m.data_cad,
        m.created_at                           AS "CreateAt",
        m.created_at,
        b.tipo                                 AS "Tipo",
        b.tipo,
        b.nome                                 AS "Base",
        b.nome                                 AS base,
        i.nome                                 AS "Igrejas",
        i.nome                                 AS igreja
      FROM membros m
      LEFT JOIN bases b     ON b.id = m.base_id
      LEFT JOIN igrejas i   ON i.id = b.igreja_id
    $SQL$;

  -- 2.2 legacy schema
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Membros'
  ) THEN
    SELECT c.column_name
      INTO v_membros_created_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'Membros'
      AND c.column_name IN ('CreatedAt', 'CreateAt', 'created_at')
    ORDER BY CASE c.column_name
      WHEN 'CreatedAt' THEN 1
      WHEN 'CreateAt' THEN 2
      WHEN 'created_at' THEN 3
      ELSE 99
    END
    LIMIT 1;

    IF v_membros_created_col IS NULL THEN
      v_membros_created_expr := 'NULL::timestamptz';
    ELSE
      v_membros_created_expr := format('m.%I', v_membros_created_col);
    END IF;

    EXECUTE format($SQL$
      CREATE OR REPLACE VIEW vw_membros AS
      SELECT
        m.id_membros                            AS id_membros,
        m.id_membros                            AS id,
        m.id_base                               AS id_base,
        m.id_base                               AS base_id,
        m."Membros"                            AS "Membros",
        m."Membros"                            AS nome,
        m."Nasc"                               AS "Nasc",
        m."Nasc"                               AS nasc,
        m."Fone"                               AS "Fone",
        m."Fone"                               AS fone,
        m."Email"                              AS "Email",
        m."Email"                              AS email,
        m."Endereco"                           AS "Endereco",
        m."Endereco"                           AS endereco,
        m."Responsavel"                        AS "Responsavel",
        m."Responsavel"                        AS responsavel,
        m."CPF"                                AS "CPF",
        m."CPF"                                AS cpf,
        m."RG"                                 AS "RG",
        m."RG"                                 AS rg,
        m."Camiseta"                           AS "Camiseta",
        m."Camiseta"                           AS camiseta,
        m."Status"                             AS "Status",
        m."Status"                             AS status,
        m."DataCad"                            AS "DataCad",
        m."DataCad"                            AS data_cad,
        %s                                      AS "CreateAt",
        %s                                      AS created_at,
        b."Tipo"                               AS "Tipo",
        b."Tipo"                               AS tipo,
        b."Base"                               AS "Base",
        b."Base"                               AS base,
        i."Igrejas"                            AS "Igrejas",
        i."Igrejas"                            AS igreja
      FROM "Membros" m
      LEFT JOIN "Bases" b     ON b.id_base = m.id_base
      LEFT JOIN "Igrejas" i   ON i.id_igrejas = b.id_igrejas
    $SQL$, v_membros_created_expr, v_membros_created_expr);

  ELSE
    RAISE NOTICE 'No membros source table found. vw_membros was not recreated.';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 3) Notas compatibility view (normalized or legacy schema)
-- Builds vw_notas dynamically so it always includes ALL data sources:
--   • normalized `notas` table (primary)
--   • legacy "Notas_Teen" / "Notas_Soul" tables (UNION when coexist)
-- ----------------------------------------------------------------
DO $$
DECLARE
  v_has_notas boolean;
  v_has_teen  boolean;
  v_has_soul  boolean;
  v_sql       text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notas')       INTO v_has_notas;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Notas_Teen') INTO v_has_teen;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Notas_Soul') INTO v_has_soul;

  IF v_has_notas THEN
    -- 3.1 normalized schema base
    v_sql := $S$
      CREATE OR REPLACE VIEW vw_notas AS
      SELECT
        n.id,
        n.id_form,
        NULL::uuid                             AS id_lote,
        n.prova_id                             AS id_provas,
        n.prova_id,
        n.tipo,
        CASE
          WHEN n.tipo = 'Soul+' THEN 'NOTAS_SOUL'
          ELSE 'NOTAS'
        END                                    AS aba,
        n.data,
        n.data                                 AS "Data",
        COALESCE(n.titulo, p.nome)             AS titulo,
        COALESCE(n.titulo, p.nome)             AS "Titulo",
        n.responsavel,

        n.base_id                              AS id_base,
        b.nome                                 AS "Base",
        b.nome                                 AS base,

        b.igreja_id                            AS id_igrejas,
        i.nome                                 AS "Igrejas",
        i.nome                                 AS "Igreja",
        i.nome                                 AS igreja,

        i.distrito_id                          AS id_distritos,
        d.nome                                 AS "Distritos",
        d.nome                                 AS "Distrito",
        d.nome                                 AS distrito,

        d.regiao_id                            AS id_regiao,
        r.nome                                 AS "Regiao",
        r.nome                                 AS regiao,

        NULL::uuid                             AS id_membros,
        n.nome_aluno                           AS "Membros",
        n.nome_aluno                           AS nome_aluno,

        n.nota                                 AS "Nota",
        n.nota,
        n.comunhao                             AS "Comunhao",
        n.comunhao,
        n.verso                                AS "Verso",
        n.verso,
        n.observacoes                          AS "Observacoes",
        n.observacoes,

        n.saved_at,
        n.created_at
      FROM notas n
      LEFT JOIN bases b     ON b.id = n.base_id
      LEFT JOIN igrejas i   ON i.id = b.igreja_id
      LEFT JOIN distritos d ON d.id = i.distrito_id
      LEFT JOIN regioes r   ON r.id = d.regiao_id
      LEFT JOIN provas p    ON p.id = n.prova_id
    $S$;

    -- 3.1a UNION legacy Notas_Teen if coexists (data migration in progress)
    IF v_has_teen THEN
      v_sql := v_sql || $S$
      UNION ALL
      SELECT
        t.id,
        t.id_form,
        NULL::uuid                             AS id_lote,
        t.id_provas,
        NULL::text                             AS prova_id,
        'G148 Teen'::text                      AS tipo,
        COALESCE(t.aba, 'NOTAS')               AS aba,
        t.data,
        t.data                                 AS "Data",
        t.titulo,
        t.titulo                               AS "Titulo",
        t.responsavel,
        t.id_base,
        t."Base"                              AS "Base",
        t."Base"                              AS base,
        t.id_igrejas,
        t."Igrejas"                           AS "Igrejas",
        t."Igrejas"                           AS "Igreja",
        t."Igrejas"                           AS igreja,
        t.id_distritos,
        t."Distritos"                         AS "Distritos",
        t."Distritos"                         AS "Distrito",
        t."Distritos"                         AS distrito,
        t.id_regiao,
        t."Regiao"                            AS "Regiao",
        t."Regiao"                            AS regiao,
        t.id_membros,
        t."Membros"                           AS "Membros",
        t."Membros"                           AS nome_aluno,
        t."Nota"                              AS "Nota",
        t."Nota"                              AS nota,
        t."Comunhao"                          AS "Comunhao",
        t."Comunhao"                          AS comunhao,
        t."Verso"                             AS "Verso",
        t."Verso"                             AS verso,
        t."Observacoes"                       AS "Observacoes",
        t."Observacoes"                       AS observacoes,
        NULL::timestamptz                      AS saved_at,
        NULL::timestamptz                      AS created_at
      FROM "Notas_Teen" t
      $S$;
    END IF;

    -- 3.1b UNION legacy Notas_Soul if coexists (data migration in progress)
    IF v_has_soul THEN
      v_sql := v_sql || $S$
      UNION ALL
      SELECT
        s.id,
        s.id_form,
        NULL::uuid                             AS id_lote,
        s.id_provas,
        NULL::text                             AS prova_id,
        'Soul+'::text                          AS tipo,
        COALESCE(s.aba, 'NOTAS_SOUL')          AS aba,
        s.data,
        s.data                                 AS "Data",
        s.titulo,
        s.titulo                               AS "Titulo",
        s.responsavel,
        s.id_base,
        s."Base"                              AS "Base",
        s."Base"                              AS base,
        s.id_igrejas,
        s."Igrejas"                           AS "Igrejas",
        s."Igrejas"                           AS "Igreja",
        s."Igrejas"                           AS igreja,
        s.id_distritos,
        s."Distritos"                         AS "Distritos",
        s."Distritos"                         AS "Distrito",
        s."Distritos"                         AS distrito,
        s.id_regiao,
        s."Regiao"                            AS "Regiao",
        s."Regiao"                            AS regiao,
        s.id_membros,
        s."Membros"                           AS "Membros",
        s."Membros"                           AS nome_aluno,
        s."Nota"                              AS "Nota",
        s."Nota"                              AS nota,
        s."Comunhao"                          AS "Comunhao",
        s."Comunhao"                          AS comunhao,
        s."Verso"                             AS "Verso",
        s."Verso"                             AS verso,
        s."Observacoes"                       AS "Observacoes",
        s."Observacoes"                       AS observacoes,
        NULL::timestamptz                      AS saved_at,
        NULL::timestamptz                      AS created_at
      FROM "Notas_Soul" s
      $S$;
    END IF;

    EXECUTE v_sql;

  -- 3.2 legacy only (no normalized notas table)
  ELSIF v_has_teen OR v_has_soul THEN
    v_sql := $S$ CREATE OR REPLACE VIEW vw_notas AS $S$;

    IF v_has_teen THEN
      v_sql := v_sql || $S$
      SELECT
        t.id,
        t.id_form,
        NULL::uuid                             AS id_lote,
        t.id_provas,
        NULL::text                             AS prova_id,
        'G148 Teen'::text                      AS tipo,
        COALESCE(t.aba, 'NOTAS')               AS aba,
        t.data,
        t.data                                 AS "Data",
        t.titulo,
        t.titulo                               AS "Titulo",
        t.responsavel,
        t.id_base,
        t."Base"                              AS "Base",
        t."Base"                              AS base,
        t.id_igrejas,
        t."Igrejas"                           AS "Igrejas",
        t."Igrejas"                           AS "Igreja",
        t."Igrejas"                           AS igreja,
        t.id_distritos,
        t."Distritos"                         AS "Distritos",
        t."Distritos"                         AS "Distrito",
        t."Distritos"                         AS distrito,
        t.id_regiao,
        t."Regiao"                            AS "Regiao",
        t."Regiao"                            AS regiao,
        t.id_membros,
        t."Membros"                           AS "Membros",
        t."Membros"                           AS nome_aluno,
        t."Nota"                              AS "Nota",
        t."Nota"                              AS nota,
        t."Comunhao"                          AS "Comunhao",
        t."Comunhao"                          AS comunhao,
        t."Verso"                             AS "Verso",
        t."Verso"                             AS verso,
        t."Observacoes"                       AS "Observacoes",
        t."Observacoes"                       AS observacoes,
        NULL::timestamptz                      AS saved_at,
        NULL::timestamptz                      AS created_at
      FROM "Notas_Teen" t
      $S$;
    END IF;

    IF v_has_soul THEN
      IF v_has_teen THEN
        v_sql := v_sql || ' UNION ALL ';
      END IF;
      v_sql := v_sql || $S$
      SELECT
        s.id,
        s.id_form,
        NULL::uuid                             AS id_lote,
        s.id_provas,
        NULL::text                             AS prova_id,
        'Soul+'::text                          AS tipo,
        COALESCE(s.aba, 'NOTAS_SOUL')          AS aba,
        s.data,
        s.data                                 AS "Data",
        s.titulo,
        s.titulo                               AS "Titulo",
        s.responsavel,
        s.id_base,
        s."Base"                              AS "Base",
        s."Base"                              AS base,
        s.id_igrejas,
        s."Igrejas"                           AS "Igrejas",
        s."Igrejas"                           AS "Igreja",
        s."Igrejas"                           AS igreja,
        s.id_distritos,
        s."Distritos"                         AS "Distritos",
        s."Distritos"                         AS "Distrito",
        s."Distritos"                         AS distrito,
        s.id_regiao,
        s."Regiao"                            AS "Regiao",
        s."Regiao"                            AS regiao,
        s.id_membros,
        s."Membros"                           AS "Membros",
        s."Membros"                           AS nome_aluno,
        s."Nota"                              AS "Nota",
        s."Nota"                              AS nota,
        s."Comunhao"                          AS "Comunhao",
        s."Comunhao"                          AS comunhao,
        s."Verso"                             AS "Verso",
        s."Verso"                             AS verso,
        s."Observacoes"                       AS "Observacoes",
        s."Observacoes"                       AS observacoes,
        NULL::timestamptz                      AS saved_at,
        NULL::timestamptz                      AS created_at
      FROM "Notas_Soul" s
      $S$;
    END IF;

    EXECUTE v_sql;

  ELSE
    RAISE NOTICE 'No notas source table found. vw_notas was not recreated.';
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 4) Filtered views used by legacy reads
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW vw_notas_teen AS
SELECT * FROM vw_notas
WHERE tipo = 'G148 Teen' OR UPPER(COALESCE(aba, '')) IN ('NOTAS', 'NOTAS_TEEN');

CREATE OR REPLACE VIEW vw_notas_soul AS
SELECT * FROM vw_notas
WHERE tipo = 'Soul+' OR UPPER(COALESCE(aba, '')) = 'NOTAS_SOUL';

-- ----------------------------------------------------------------
-- 5) Grants
-- ----------------------------------------------------------------
GRANT SELECT ON vw_bases TO anon, authenticated;
GRANT SELECT ON vw_membros TO anon, authenticated;
GRANT SELECT ON vw_notas TO anon, authenticated;
GRANT SELECT ON vw_notas_teen TO anon, authenticated;
GRANT SELECT ON vw_notas_soul TO anon, authenticated;
