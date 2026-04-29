-- ================================================================
-- Normaliza datas de formato BR (dd/mm/yyyy) para ISO (yyyy-mm-dd)
-- nas tabelas legadas Notas_Soul e Notas_Teen.
--
-- Motivação: o Comparativo e outras queries filtram por data usando
-- comparação lexicográfica ISO. Datas em BR falham silenciosamente
-- nesses filtros (ex: '28/03/2026' não está no range '2026-03-28'
-- a '2026-06-20' por comparação de texto).
--
-- A exibição em formato BR continua sendo feita pelo frontend (fmtDate).
-- ================================================================

-- ── Notas_Soul ───────────────────────────────────────────────────
UPDATE public."Notas_Soul"
SET data = (
  substr(data, 7, 4) || '-' ||
  substr(data, 4, 2) || '-' ||
  substr(data, 1, 2)
)
WHERE data ~ '^\d{2}/\d{2}/\d{4}$';

-- ── Notas_Teen ───────────────────────────────────────────────────
UPDATE public."Notas_Teen"
SET data = (
  substr(data, 7, 4) || '-' ||
  substr(data, 4, 2) || '-' ||
  substr(data, 1, 2)
)
WHERE data ~ '^\d{2}/\d{2}/\d{4}$';

-- ── Verificação pós-migração (execute manualmente se quiser conferir):
--
-- SELECT
--   CASE
--     WHEN data ~ '^\d{4}-\d{2}-\d{2}' THEN 'ISO'
--     WHEN data ~ '^\d{2}/\d{2}/\d{4}' THEN 'BR'
--     ELSE 'Outro'
--   END AS formato,
--   COUNT(*) AS qtd
-- FROM "Notas_Soul"
-- WHERE data IS NOT NULL
-- GROUP BY 1;
