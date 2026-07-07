-- ============================================================
-- Correção: reverte cadencia='mensal' aplicada por engano em
-- Assiduidade/Comunhão do Soul+ (migration 20260707100000).
--
-- Todo sábado do trimestre tem um lançamento no Soul+ — "Registro
-- Semanal" nas semanas normais (com Comunhão/Verso) ou "NN Prova
-- Soul+" na semana mensal da prova. Ou seja, a cadência real desses
-- dois desafios administrativos é semanal (13 sábados/trimestre),
-- igual ao G148 Teen — só a nota da prova em si é mensal, e isso já
-- é tratado separadamente no ranking de alunos (filtro por título
-- contendo "Prova"), não na pontuação de desafios da base.
-- ============================================================

UPDATE desafios_catalogo
SET cadencia = 'semanal'
WHERE tipo = 'Soul+'
  AND rastreamento = 'semanal'
  AND cadencia = 'mensal';
