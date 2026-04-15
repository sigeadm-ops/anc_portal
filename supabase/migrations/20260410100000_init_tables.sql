-- ================================================================
-- 1. TABELAS DIMENSÃO (Regioes, Distritos, Igrejas)
-- ================================================================

CREATE TABLE IF NOT EXISTS regioes (
  id   TEXT PRIMARY KEY,              -- ex: R01
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS distritos (
  id        TEXT PRIMARY KEY,         -- ex: D01
  nome      TEXT NOT NULL,
  regiao_id TEXT NOT NULL REFERENCES regioes(id) ON DELETE RESTRICT,
  UNIQUE(nome, regiao_id)
);

CREATE TABLE IF NOT EXISTS igrejas (
  id               TEXT PRIMARY KEY,  -- ex: I001
  nome             TEXT NOT NULL,
  distrito_id      TEXT NOT NULL REFERENCES distritos(id) ON DELETE RESTRICT,
  codref           TEXT,
  tipo_templo      TEXT,              -- 'Igreja', 'Grupo', etc.
  pastor_distrital TEXT,
  UNIQUE(nome, distrito_id)
);

-- ================================================================
-- 2. BASES E MEMBROS
-- ================================================================

CREATE TABLE IF NOT EXISTS bases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_origem  TEXT,                   -- ex: B050 — apenas para auditoria de migração
  tipo        TEXT NOT NULL CHECK (tipo IN ('G148 Teen', 'Soul+')),
  nome        TEXT NOT NULL,
  igreja_id   TEXT NOT NULL REFERENCES igrejas(id) ON DELETE RESTRICT,
  coord       TEXT,
  coord_fone  TEXT,
  coord_email TEXT,
  prof        TEXT,
  prof_fone   TEXT,
  prof_email  TEXT,
  midia       TEXT,
  midia_fone  TEXT,
  midia_email TEXT,
  data_cad    DATE DEFAULT CURRENT_DATE,
  status      TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nome, tipo, igreja_id)
);

CREATE TABLE IF NOT EXISTS membros (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_origem  TEXT,                   -- ex: M128 — apenas para auditoria de migração
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE RESTRICT,
  nome        TEXT NOT NULL,
  nasc        DATE,
  fone        TEXT,
  email       TEXT,
  endereco    TEXT,
  responsavel TEXT,
  cpf         TEXT,
  rg          TEXT,
  camiseta    TEXT,
  status      TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  data_cad    DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. PROVAS, NOTAS E PONTUAÇÕES
-- ================================================================

CREATE TABLE IF NOT EXISTS provas (
  id         TEXT PRIMARY KEY,        -- ex: PG01 (Teen) / PS01 (Soul+)
  tipo       TEXT NOT NULL CHECK (tipo IN ('G148 Teen', 'Soul+')),
  nome       TEXT NOT NULL,
  data       DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tipo, nome)
);

CREATE TABLE IF NOT EXISTS notas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_form     UUID NOT NULL,
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE RESTRICT,
  prova_id    TEXT REFERENCES provas(id) ON DELETE SET NULL,
  tipo        TEXT CHECK (tipo IN ('G148 Teen', 'Soul+')),
  data        DATE,
  titulo      TEXT,
  responsavel TEXT,
  nome_aluno  TEXT NOT NULL,
  nota        NUMERIC(4,1) CHECK (nota >= 0 AND nota <= 99),
  nota_1000   TEXT CHECK (nota_1000 IN ('Sim', 'Não')),
  verso       TEXT CHECK (verso     IN ('Sim', 'Não')),
  discipulo   TEXT CHECK (discipulo IN ('Sim', 'Não')),
  comunhao    TEXT,
  observacoes TEXT,
  saved_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pontuacoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id  TEXT NOT NULL REFERENCES igrejas(id) ON DELETE RESTRICT,
  data       DATE,
  tipo       TEXT,
  pontos     NUMERIC,
  status     TEXT DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Aprovado', 'Rejeitado')),
  obs        TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 4. ÍNDICES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_distritos_regiao   ON distritos  (regiao_id);
CREATE INDEX IF NOT EXISTS idx_igrejas_distrito   ON igrejas    (distrito_id);
CREATE INDEX IF NOT EXISTS idx_bases_igreja       ON bases      (igreja_id);
CREATE INDEX IF NOT EXISTS idx_bases_tipo         ON bases      (tipo);
CREATE INDEX IF NOT EXISTS idx_bases_tipo_igreja  ON bases      (tipo, igreja_id);
CREATE INDEX IF NOT EXISTS idx_membros_base       ON membros    (base_id);
CREATE INDEX IF NOT EXISTS idx_membros_status     ON membros    (base_id, status);
CREATE INDEX IF NOT EXISTS idx_membros_nome       ON membros    (nome);
CREATE INDEX IF NOT EXISTS idx_notas_base         ON notas      (base_id);
CREATE INDEX IF NOT EXISTS idx_notas_id_form      ON notas      (id_form);
CREATE INDEX IF NOT EXISTS idx_notas_tipo_base    ON notas      (tipo, base_id);
CREATE INDEX IF NOT EXISTS idx_notas_prova        ON notas      (prova_id);
CREATE INDEX IF NOT EXISTS idx_pont_igreja        ON pontuacoes (igreja_id);
