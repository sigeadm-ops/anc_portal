-- ================================================================
-- Migração segura: padroniza id_form legado para UUID (texto UUID)
-- Escopo:
--   - public."Notas_Teen"
--   - public."Notas_Soul"
-- Estratégia:
--   1) Backup snapshot das linhas que serão alteradas (uma única vez)
--   2) Mapeamento determinístico old_id_form -> new_id_form (UUID)
--   3) Update nas duas tabelas legadas
--
-- Observações:
--   - Não altera id_form já válido como UUID.
--   - Preserva consistência entre Teen/Soul: mesmo old_id_form gera o mesmo UUID.
--   - Coluna id_form permanece TEXT nas tabelas legadas, mas passa a conter UUID string.
-- ================================================================

BEGIN;

DO $$
BEGIN
  -- Backup Teen (snapshot único)
  IF to_regclass('public.backup_20260426_notas_teen_id_form') IS NULL THEN
    CREATE TABLE public.backup_20260426_notas_teen_id_form AS
    SELECT *
    FROM public."Notas_Teen" t
    WHERE t.id_form IS NOT NULL
      AND btrim(t.id_form) <> ''
      AND NOT (
        t.id_form ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      );
  END IF;

  -- Backup Soul (snapshot único)
  IF to_regclass('public.backup_20260426_notas_soul_id_form') IS NULL THEN
    CREATE TABLE public.backup_20260426_notas_soul_id_form AS
    SELECT *
    FROM public."Notas_Soul" s
    WHERE s.id_form IS NOT NULL
      AND btrim(s.id_form) <> ''
      AND NOT (
        s.id_form ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      );
  END IF;
END $$;

-- Tabela de auditoria/mapeamento (persistente)
CREATE TABLE IF NOT EXISTS public.backup_20260426_id_form_map (
  old_id_form TEXT PRIMARY KEY,
  new_id_form UUID NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Popula mapa apenas para IDs antigos ainda não mapeados
INSERT INTO public.backup_20260426_id_form_map (old_id_form, new_id_form)
SELECT DISTINCT
  src.id_form AS old_id_form,
  (
    substr(md5(lower(trim(src.id_form))), 1, 8) || '-' ||
    substr(md5(lower(trim(src.id_form))), 9, 4) || '-' ||
    '4' || substr(md5(lower(trim(src.id_form))), 14, 3) || '-' ||
    'a' || substr(md5(lower(trim(src.id_form))), 18, 3) || '-' ||
    substr(md5(lower(trim(src.id_form))), 21, 12)
  )::uuid AS new_id_form
FROM (
  SELECT t.id_form
  FROM public."Notas_Teen" t
  WHERE t.id_form IS NOT NULL
    AND btrim(t.id_form) <> ''
    AND NOT (
      t.id_form ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )

  UNION

  SELECT s.id_form
  FROM public."Notas_Soul" s
  WHERE s.id_form IS NOT NULL
    AND btrim(s.id_form) <> ''
    AND NOT (
      s.id_form ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
) src
ON CONFLICT (old_id_form) DO NOTHING;

-- Atualiza Teen
UPDATE public."Notas_Teen" t
SET id_form = m.new_id_form::text
FROM public.backup_20260426_id_form_map m
WHERE t.id_form = m.old_id_form;

-- Atualiza Soul
UPDATE public."Notas_Soul" s
SET id_form = m.new_id_form::text
FROM public.backup_20260426_id_form_map m
WHERE s.id_form = m.old_id_form;

COMMIT;

-- ================================================================
-- Verificação pós-migração (execute manualmente se quiser conferir):
--
-- SELECT COUNT(*) AS teen_nao_uuid
-- FROM public."Notas_Teen"
-- WHERE id_form IS NOT NULL
--   AND btrim(id_form) <> ''
--   AND NOT (id_form ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
--
-- SELECT COUNT(*) AS soul_nao_uuid
-- FROM public."Notas_Soul"
-- WHERE id_form IS NOT NULL
--   AND btrim(id_form) <> ''
--   AND NOT (id_form ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
-- ================================================================
