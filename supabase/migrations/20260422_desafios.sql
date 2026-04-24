-- ============================================================
-- Migração: Módulo de Desafios G148 Teen
-- Tabelas: configuracao_trimestres, desafios_catalogo,
--          desafios_registros, desafios_marcos
-- ============================================================

-- 1. Configuração de trimestres (admin define 1º e último sábado)
CREATE TABLE IF NOT EXISTS configuracao_trimestres (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ano           int         NOT NULL,
  trimestre     smallint    NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  primeiro_sabado date      NOT NULL,
  ultimo_sabado   date      NOT NULL,
  criado_em     timestamptz DEFAULT now(),
  UNIQUE(ano, trimestre)
);

-- 2. Catálogo de desafios (seed abaixo)
CREATE TABLE IF NOT EXISTS desafios_catalogo (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        text        UNIQUE NOT NULL,
  nome          text        NOT NULL,
  descricao     text,
  categoria     text,       -- 'admin' | 'da' | 'estudo' | 'midia' | 'missao'
  rastreamento  text        NOT NULL DEFAULT 'pontual'
                              CHECK (rastreamento IN ('semanal', 'pontual')),
  periodicidade text        NOT NULL
                              CHECK (periodicidade IN ('trimestral', 'anual')),
  pontos_total  numeric(8,2) NOT NULL,
  ordem         smallint    DEFAULT 99,
  ativo         boolean     DEFAULT true
);

-- 3. Marcações semanais por sábado (rastreamento = 'semanal')
-- base_id referencia Bases.id_base (texto legível ex: 'B020', sem FK declarada)
CREATE TABLE IF NOT EXISTS desafios_registros (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       text        NOT NULL,
  desafio_id    uuid        NOT NULL REFERENCES desafios_catalogo(id),
  data_sabado   date        NOT NULL,
  realizado     boolean     NOT NULL DEFAULT false,
  responsavel   text,
  obs           text,
  criado_em     timestamptz DEFAULT now(),
  UNIQUE(base_id, desafio_id, data_sabado)
);

-- 4. Marcos pontuais por trimestre ou ano (rastreamento = 'pontual')
-- base_id referencia Bases.id_base (texto legível ex: 'B020', sem FK declarada)
CREATE TABLE IF NOT EXISTS desafios_marcos (
  id              uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id         text      NOT NULL,
  desafio_id      uuid      NOT NULL REFERENCES desafios_catalogo(id),
  ano             int       NOT NULL,
  trimestre       smallint  CHECK (trimestre BETWEEN 1 AND 4),  -- NULL = anual
  realizado       boolean   NOT NULL DEFAULT false,
  data_realizacao date,
  responsavel     text,
  obs             text,
  criado_em       timestamptz DEFAULT now()
);
-- Índices únicos parciais para tratar NULL em trimestre corretamente
CREATE UNIQUE INDEX IF NOT EXISTS idx_marcos_unique_trim
  ON desafios_marcos(base_id, desafio_id, ano, trimestre)
  WHERE trimestre IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_marcos_unique_anual
  ON desafios_marcos(base_id, desafio_id, ano)
  WHERE trimestre IS NULL;

-- ── Índices ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_desafios_registros_base
  ON desafios_registros(base_id);
CREATE INDEX IF NOT EXISTS idx_desafios_registros_sabado
  ON desafios_registros(data_sabado);
CREATE INDEX IF NOT EXISTS idx_desafios_registros_base_desafio
  ON desafios_registros(base_id, desafio_id);
CREATE INDEX IF NOT EXISTS idx_desafios_marcos_base
  ON desafios_marcos(base_id);
CREATE INDEX IF NOT EXISTS idx_desafios_marcos_ano
  ON desafios_marcos(ano, trimestre);

-- ── RLS ────────────────────────────────────────────────────────────
ALTER TABLE configuracao_trimestres ENABLE ROW LEVEL SECURITY;
ALTER TABLE desafios_catalogo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE desafios_registros      ENABLE ROW LEVEL SECURITY;
ALTER TABLE desafios_marcos         ENABLE ROW LEVEL SECURITY;

-- Leitura pública (padrão do projeto)
CREATE POLICY "configuracao_trimestres_select" ON configuracao_trimestres
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "desafios_catalogo_select" ON desafios_catalogo
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "desafios_registros_select" ON desafios_registros
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "desafios_marcos_select" ON desafios_marcos
  FOR SELECT TO anon, authenticated USING (true);

-- Escrita pública (padrão do projeto — restringir após auditoria)
CREATE POLICY "configuracao_trimestres_write" ON configuracao_trimestres
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "desafios_catalogo_write" ON desafios_catalogo
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "desafios_registros_write" ON desafios_registros
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "desafios_marcos_write" ON desafios_marcos
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── Seed: Catálogo de Desafios ─────────────────────────────────────
INSERT INTO desafios_catalogo
  (codigo, nome, descricao, categoria, rastreamento, periodicidade, pontos_total, ordem)
VALUES
  (
    'cartao_es',
    'Preenchimento do Cartão ES',
    'Preenchimento do Cartão de Estatísticas trimestral da base.',
    'admin', 'pontual', 'trimestral', 200, 1
  ),
  (
    'planilha',
    'Preenchimento da Planilha',
    'Envio da planilha de pontuação preenchida para a ANP no trimestre.',
    'admin', 'pontual', 'trimestral', 200, 2
  ),
  (
    'participacao_trimestral',
    'Participação nas Trimestrais',
    'Participação da base no evento trimestral da associação.',
    'admin', 'pontual', 'trimestral', 200, 3
  ),
  (
    'desafio_da',
    'Desafio da Associação (DA)',
    '1º Trim: Calebe / 10 Dias de Oração / Semana Santa. 2º: Papo Teen / Saia do Quarto / Ajuda Comunitária. 3º: Papo Teen / Quebrando Silêncio / Maná Teen. 4º: Mutirão de Natal / Saia do Quarto / Papo Teen. Pontua 50 pts por realizar ao menos um desafio no trimestre.',
    'da', 'semanal', 'trimestral', 50, 4
  ),
  (
    'pg_teen',
    'PG Teen / Classe Bíblica',
    'Reunião da base para estudo bíblico ou coordenação de classe bíblica, com frequência quinzenal mínima.',
    'estudo', 'semanal', 'trimestral', 50, 5
  ),
  (
    'midia_instagram',
    'Mídia – Instagram da Base ATIVO',
    'Perfil do Instagram da base ativo, com postagens dos desafios dentro do prazo.',
    'midia', 'semanal', 'trimestral', 50, 6
  ),
  (
    'montar_perfil',
    'Montar Perfil Face/Insta',
    'Criação do perfil da base nas redes sociais dentro do prazo estipulado pela ANP. Desafio anual único.',
    'midia', 'pontual', 'anual', 50, 7
  ),
  (
    'batismo_c1s1',
    'Batismo / C1S1',
    'A base levou ao menos uma pessoa ao batismo no ano, participando ativamente do processo de conversão.',
    'missao', 'pontual', 'anual', 400, 8
  ),
  (
    'discipulo_teen',
    'Discípulo Teen (50% ativos)',
    'Pelo menos 50% dos adolescentes da base fazendo o cartão do Discípulo Teen.',
    'missao', 'pontual', 'anual', 250, 9
  ),
  (
    'os_300',
    'Os 300 – Elite Missionária',
    'A base atingiu o critério Os 300 de elite missionária anual.',
    'missao', 'pontual', 'anual', 300, 10
  ),
  (
    'treinamento_midia',
    'Treinamento Anual de Mídia',
    'Participação no treinamento anual de mídia da ANP.',
    'midia', 'pontual', 'anual', 100, 11
  )
ON CONFLICT (codigo) DO NOTHING;
