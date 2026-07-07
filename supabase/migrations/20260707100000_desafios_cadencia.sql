-- ============================================================
-- Migração: Cadência de desafios semanais (semanal vs mensal)
-- Objetivo: permitir declarar, por desafio de rastreamento='semanal',
--           se o esperado é 1x/semana (divide pelo nº de sábados do
--           trimestre) ou 1x/mês (divide pelo nº de meses).
--
-- No Soul+, Assiduidade e Comunhão Diária ficam como 'semanal'
-- (default) porque todo sábado do trimestre tem algum lançamento —
-- "Registro Semanal" nas semanas normais ou "Prova Soul+" na semana
-- mensal — então esses desafios têm a mesma cadência de 13
-- sábados/trimestre do G148 Teen. Só a NOTA (prova) em si é que
-- acontece 1x/mês, e isso é tratado à parte no ranking de alunos,
-- não na pontuação de desafios da base.
-- ============================================================

ALTER TABLE desafios_catalogo
  ADD COLUMN IF NOT EXISTS cadencia text NOT NULL DEFAULT 'semanal'
    CHECK (cadencia IN ('semanal', 'mensal'));
