-- ================================================================
-- REPARO DE EMERGÊNCIA: VIEWS DE NOTAS
-- Alinha os nomes das colunas das views com o frontend legado
-- ================================================================

-- 1. Recriar View Principal com Aliases de Compatibilidade
CREATE OR REPLACE VIEW vw_notas AS
SELECT
  n.id, 
  n.id_form, 
  n.prova_id, 
  n.tipo, 
  n.data, 
  n.titulo, 
  n.responsavel,
  n.nome_aluno, 
  n.nota, 
  n.saved_at, 
  n.created_at,
  n.base_id,
  -- Aliases em Maiúsculo para o Frontend (React)
  n.nome_aluno  AS "Membros",
  n.nota        AS "Nota",
  n.comunhao    AS "Comunhao",
  n.observacoes AS "Observacoes",
  n.data        AS "Data",
  n.titulo      AS "Titulo",
  -- Dados da Base/Igreja
  b.nome        AS "Base",
  i.nome        AS "Igreja",
  d.nome        AS "Distrito",
  r.nome        AS "Regiao",
  -- IDS
  b.igreja_id,
  i.distrito_id,
  d.regiao_id,
  -- Dados da prova (quando vinculada)
  pr.nome       AS prova_nome,
  pr.tipo       AS prova_tipo
FROM notas n
JOIN bases     b  ON b.id  = n.base_id
JOIN igrejas   i  ON i.id  = b.igreja_id
JOIN distritos d  ON d.id  = i.distrito_id
JOIN regioes   r  ON r.id  = d.regiao_id
LEFT JOIN provas pr ON pr.id = n.prova_id;

-- 2. Recriar Views Filtradas
CREATE OR REPLACE VIEW vw_notas_teen AS 
SELECT * FROM vw_notas WHERE tipo = 'G148 Teen';

CREATE OR REPLACE VIEW vw_notas_soul AS 
SELECT * FROM vw_notas WHERE tipo = 'Soul+';

-- 3. Garantir Permissões
GRANT SELECT ON vw_notas TO anon;
GRANT SELECT ON vw_notas_teen TO anon;
GRANT SELECT ON vw_notas_soul TO anon;
