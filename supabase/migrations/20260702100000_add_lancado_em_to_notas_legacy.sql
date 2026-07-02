-- ================================================================
-- Adiciona coluna de auditoria "lancado_em" (data/hora real do envio
-- do formulário) às tabelas legadas de notas, e expõe esse campo nas
-- views de leitura.
--
-- Motivação: a coluna "data" guarda a data DA PROVA/LIÇÃO (ex.: a
-- data do sábado), não quando o registro foi de fato salvo no banco.
-- Isso impedia diferenciar, em caso de lançamento duplicado da mesma
-- turma/prova, qual submissão foi feita primeiro e qual veio depois
-- (ex.: uma correção reenviada no mesmo dia ou dias depois).
--
-- "lancado_em" é preenchida automaticamente pelo banco (DEFAULT now())
-- e não precisa de nenhuma mudança no código de inserção do app. Não é
-- exibida nos formulários/relatórios públicos — fica disponível só
-- para consulta administrativa via SQL.
-- ================================================================

-- 1. Adiciona a coluna nas tabelas legadas (idempotente)
ALTER TABLE "Notas_Teen"
  ADD COLUMN IF NOT EXISTS lancado_em TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE "Notas_Soul"
  ADD COLUMN IF NOT EXISTS lancado_em TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Recria vw_notas_teen expondo também lancado_em
DROP VIEW IF EXISTS vw_notas_teen;
CREATE OR REPLACE VIEW vw_notas_teen AS
SELECT
  vn.*,
  t.discipulado,
  t.trezentos_treinamento,
  t.trezentos_estudo,
  t.lancado_em
FROM (
  SELECT * FROM vw_notas
  WHERE tipo = 'G148 Teen'
     OR UPPER(COALESCE(aba, '')) IN ('NOTAS', 'NOTAS_TEEN')
) vn
LEFT JOIN "Notas_Teen" t ON t.id = vn.id;

-- 3. Recria vw_notas_soul expondo também lancado_em
DROP VIEW IF EXISTS vw_notas_soul;
CREATE OR REPLACE VIEW vw_notas_soul AS
SELECT
  vn.*,
  s.discipulado,
  s.trezentos_treinamento,
  s.trezentos_estudo,
  s.lancado_em
FROM (
  SELECT * FROM vw_notas
  WHERE tipo = 'Soul+'
     OR UPPER(COALESCE(aba, '')) = 'NOTAS_SOUL'
) vn
LEFT JOIN "Notas_Soul" s ON s.id = vn.id;

-- 4. Restaura permissões
GRANT SELECT ON vw_notas_teen TO anon, authenticated;
GRANT SELECT ON vw_notas_soul TO anon, authenticated;

-- ================================================================
-- Consulta de exemplo para uso administrativo (comparar lançamentos
-- da mesma prova/base/data por ordem de chegada):
--
-- SELECT id, "Membros", "Nota", data, lancado_em
-- FROM "Notas_Teen"
-- WHERE "Base" ILIKE '%invictos%'
--   AND data::text LIKE '%2026-05-16%'
-- ORDER BY "Membros", lancado_em;
-- ================================================================
