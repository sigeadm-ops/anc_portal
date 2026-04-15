-- ================================================================
-- 1. VIEWS — Dados desnormalizados para leitura
-- ================================================================

CREATE OR REPLACE VIEW vw_bases AS
SELECT
  b.id, b.cod_origem, b.tipo, b.nome, b.status, b.data_cad,
  b.coord,  b.coord_fone,  b.coord_email,
  b.prof,   b.prof_fone,   b.prof_email,
  b.midia,  b.midia_fone,  b.midia_email,
  b.created_at, b.updated_at,
  b.igreja_id,
  i.nome             AS igreja,
  i.codref,
  i.tipo_templo,
  i.pastor_distrital,
  i.distrito_id,
  d.nome        AS distrito,
  d.regiao_id,
  r.nome        AS regiao
FROM bases b
JOIN igrejas   i ON i.id = b.igreja_id
JOIN distritos d ON d.id = i.distrito_id
JOIN regioes   r ON r.id = d.regiao_id;

CREATE OR REPLACE VIEW vw_membros AS
SELECT
  m.id, m.cod_origem, m.nome, m.status, m.data_cad,
  m.nasc, m.fone, m.email, m.endereco,
  m.responsavel, m.cpf, m.rg, m.camiseta,
  m.created_at, m.updated_at,
  m.base_id,
  b.nome        AS nome_base,
  b.tipo        AS tipo,
  b.igreja_id,
  i.nome        AS nome_igreja,
  i.distrito_id,
  d.nome        AS distrito,
  d.regiao_id,
  r.nome        AS regiao
FROM membros m
JOIN bases     b ON b.id = m.base_id
JOIN igrejas   i ON i.id = b.igreja_id
JOIN distritos d ON d.id = i.distrito_id
JOIN regioes   r ON r.id = d.regiao_id;

CREATE OR REPLACE VIEW vw_pontuacoes AS
SELECT
  p.id, p.data, p.tipo, p.pontos, p.status, p.obs,
  p.created_at, p.updated_at,
  p.igreja_id,
  i.nome        AS nome_igreja,
  i.distrito_id,
  d.nome        AS distrito,
  d.regiao_id,
  r.nome        AS regiao
FROM pontuacoes p
JOIN igrejas   i ON i.id = p.igreja_id
JOIN distritos d ON d.id = i.distrito_id
JOIN regioes   r ON r.id = d.regiao_id;

CREATE OR REPLACE VIEW vw_notas AS
SELECT
  n.id, n.id_form, n.prova_id, n.tipo, n.data, n.titulo, n.responsavel,
  n.nome_aluno, n.nota, n.nota_1000, n.verso, n.discipulo,
  n.comunhao, n.observacoes, n.saved_at, n.created_at,
  n.base_id,
  b.nome        AS base,
  b.tipo        AS tipo_base,
  b.igreja_id,
  i.nome        AS igreja,
  i.distrito_id,
  d.nome        AS distrito,
  d.regiao_id,
  r.nome        AS regiao,
  -- Dados da prova (quando vinculada)
  pr.nome       AS prova_nome,
  pr.tipo       AS prova_tipo
FROM notas n
JOIN bases     b  ON b.id  = n.base_id
JOIN igrejas   i  ON i.id  = b.igreja_id
JOIN distritos d  ON d.id  = i.distrito_id
JOIN regioes   r  ON r.id  = d.regiao_id
LEFT JOIN provas pr ON pr.id = n.prova_id;

CREATE OR REPLACE VIEW vw_audit_bases_duplicadas AS
SELECT
  b.cod_origem,
  COUNT(*)               AS total,
  ARRAY_AGG(b.id::text)  AS uuids,
  ARRAY_AGG(i.nome)      AS igrejas,
  ARRAY_AGG(b.tipo)      AS tipos
FROM bases b
JOIN igrejas i ON i.id = b.igreja_id
WHERE b.cod_origem IS NOT NULL
GROUP BY b.cod_origem
HAVING COUNT(*) > 1;

-- ================================================================
-- 2. FUNÇÕES E TRIGGERS (Automático: updated_at)
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bases_updated_at      ON bases;
DROP TRIGGER IF EXISTS membros_updated_at    ON membros;
DROP TRIGGER IF EXISTS provas_updated_at     ON provas;
DROP TRIGGER IF EXISTS pontuacoes_updated_at ON pontuacoes;

CREATE TRIGGER bases_updated_at
  BEFORE UPDATE ON bases      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER membros_updated_at
  BEFORE UPDATE ON membros    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER provas_updated_at
  BEFORE UPDATE ON provas     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pontuacoes_updated_at
  BEFORE UPDATE ON pontuacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
