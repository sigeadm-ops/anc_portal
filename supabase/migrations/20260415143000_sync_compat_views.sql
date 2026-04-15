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
-- 1) Bases compatibility view
-- ----------------------------------------------------------------
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
  b.igreja_id,
  i.id                                   AS igreja_id,
  i.nome                                 AS "Igreja_Nome",
  i.nome                                 AS "Igrejas",
  i.nome                                 AS igreja,

  i.distrito_id                          AS id_distritos,
  i.distrito_id,
  d.id                                   AS distrito_id,
  d.nome                                 AS "Distrito_Nome",
  d.nome                                 AS "Distritos",
  d.nome                                 AS distrito,

  d.regiao_id                            AS id_regiao,
  d.regiao_id,
  r.id                                   AS regiao_id,
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
LEFT JOIN regioes r   ON r.id = d.regiao_id;

-- ----------------------------------------------------------------
-- 2) Membros compatibility view
-- ----------------------------------------------------------------
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
LEFT JOIN igrejas i   ON i.id = b.igreja_id;

-- ----------------------------------------------------------------
-- 3) Notas compatibility view (normalized or legacy schema)
-- ----------------------------------------------------------------
DO $$
BEGIN
  -- 3.1 normalized schema: notas
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notas'
  ) THEN
    EXECUTE $SQL$
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
    $SQL$;

  -- 3.2 legacy schema: Notas_Teen / Notas_Soul
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Notas_Teen'
  ) OR EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Notas_Soul'
  ) THEN
    EXECUTE $SQL$
      CREATE OR REPLACE VIEW vw_notas AS
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
    $SQL$;

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
