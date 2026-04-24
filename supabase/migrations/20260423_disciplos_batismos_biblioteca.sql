-- Migration: Discípulos Teen, Batismos, Biblioteca de Imagens
-- Aplicar no Supabase Dashboard > SQL Editor

-- ============================================================
-- 1. CATÁLOGO DOS 11 REQUISITOS DO CARTÃO DISCÍPULO TEEN
-- ============================================================
CREATE TABLE IF NOT EXISTS discipulos_requisitos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero smallint UNIQUE NOT NULL CHECK (numero BETWEEN 1 AND 11),
  descricao text NOT NULL,
  pontos numeric(8,2) NOT NULL DEFAULT 0,
  ativo boolean DEFAULT true
);

INSERT INTO discipulos_requisitos_catalogo (numero, descricao, pontos) VALUES
(1, 'Estar matriculado e frequentando uma Classe da Escola Sabatina (Base do G148Teen) e tendo a sua comunhão diária por meio do estudo da Bíblia, lição da Escola Sabatina e Espírito de Profecia (BEP TEEN e CRM).', 0),
(2, 'Ser membro batizado ou estar recebendo estudo bíblico e se preparando para o batismo.', 0),
(3, 'Participar de um treinamento do projeto "Grupo de Elite Missionária", conhecido como "300 de Gideão", promovido por sua Associação e/ou Base.', 0),
(4, 'Escolher um departamento da igreja para conhecer e acompanhar o(a) líder durante o ano em todas as suas atividades.', 0),
(5, 'Participar de um curso ou treinamento para o departamento escolhido, promovido pela Associação ou pela igreja local.', 0),
(6, 'Participar de uma comissão da sua igreja como convidado(a) especial.', 0),
(7, 'Falar com o(a) professor(a) da Classe (Base G148Teen) para registrar seu nome como Discípulo Teen aprendiz no ACMS e no cartão da Escola Sabatina.', 0),
(8, 'Participar de um evento promovido pelo Ministério do Adolescente da Associação ou distrito local (Ex: Inter base, Trimestral, acampamento, etc)', 0),
(9, 'Aprender com o líder de Mordomia ou pastor da igreja o que é ser um "Mordomo Fiel" ou participar de um treinamento sobre Mordomia.', 0),
(10, 'Participar ou visitar um Clube de Desbravadores.', 0),
(11, 'Participar do "Celebra Teen" promovido pelo MA de sua Associação.', 0)
ON CONFLICT (numero) DO NOTHING;

-- ============================================================
-- 2. TRACKING DE REQUISITOS POR ALUNO
-- ============================================================
-- membro_id armazenado como text (sem FK) para compatibilidade com schema legado "Membros"
-- base_id também é text, mesmo padrão dos desafios
CREATE TABLE IF NOT EXISTS discipulos_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_id text NOT NULL,
  base_id text NOT NULL,
  requisito_id uuid NOT NULL REFERENCES discipulos_requisitos_catalogo(id),
  ano int NOT NULL,
  realizado boolean NOT NULL DEFAULT false,
  data_realizacao date,
  responsavel text,
  criado_em timestamptz DEFAULT now(),
  UNIQUE(membro_id, requisito_id, ano)
);

CREATE INDEX IF NOT EXISTS idx_discipulos_registros_base ON discipulos_registros(base_id, ano);
CREATE INDEX IF NOT EXISTS idx_discipulos_registros_membro ON discipulos_registros(membro_id, ano);

-- ============================================================
-- 3. REGISTRO DE BATISMOS INDIVIDUAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS batismos_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id text NOT NULL,
  nome text NOT NULL,
  mes smallint CHECK (mes BETWEEN 1 AND 12),
  ano int NOT NULL,
  foto_url text,
  obs text,
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batismos_registros_base ON batismos_registros(base_id, ano);

-- ============================================================
-- 4. BIBLIOTECA DE IMAGENS POR BASE
-- ============================================================
CREATE TABLE IF NOT EXISTS biblioteca_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id text NOT NULL,
  titulo text NOT NULL,
  url text NOT NULL,
  data_upload date NOT NULL DEFAULT CURRENT_DATE,
  observacao text,
  criado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biblioteca_imagens_base ON biblioteca_imagens(base_id);

-- ============================================================
-- 5. CONFIG GLOBAL DE PONTOS POR BATISMO
-- ============================================================
CREATE TABLE IF NOT EXISTS batismos_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pontos_por_batismo numeric(8,2) NOT NULL DEFAULT 0
);

INSERT INTO batismos_config (id, pontos_por_batismo) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. RLS (mesmo padrão permissivo das outras tabelas)
-- ============================================================
ALTER TABLE discipulos_requisitos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE discipulos_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE batismos_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE biblioteca_imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE batismos_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- discipulos_requisitos_catalogo
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discipulos_requisitos_catalogo' AND policyname='select_all') THEN
    CREATE POLICY "select_all" ON discipulos_requisitos_catalogo FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discipulos_requisitos_catalogo' AND policyname='write_all') THEN
    CREATE POLICY "write_all" ON discipulos_requisitos_catalogo FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  -- discipulos_registros
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discipulos_registros' AND policyname='select_all') THEN
    CREATE POLICY "select_all" ON discipulos_registros FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='discipulos_registros' AND policyname='write_all') THEN
    CREATE POLICY "write_all" ON discipulos_registros FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  -- batismos_registros
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='batismos_registros' AND policyname='select_all') THEN
    CREATE POLICY "select_all" ON batismos_registros FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='batismos_registros' AND policyname='write_all') THEN
    CREATE POLICY "write_all" ON batismos_registros FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  -- biblioteca_imagens
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='biblioteca_imagens' AND policyname='select_all') THEN
    CREATE POLICY "select_all" ON biblioteca_imagens FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='biblioteca_imagens' AND policyname='write_all') THEN
    CREATE POLICY "write_all" ON biblioteca_imagens FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;

  -- batismos_config
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='batismos_config' AND policyname='select_all') THEN
    CREATE POLICY "select_all" ON batismos_config FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='batismos_config' AND policyname='write_all') THEN
    CREATE POLICY "write_all" ON batismos_config FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 7. BUCKET DE STORAGE "anc-media" (público)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anc-media',
  'anc-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policies de storage (leitura pública, escrita para anon)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='anc-media public read') THEN
    CREATE POLICY "anc-media public read" ON storage.objects
      FOR SELECT TO anon USING (bucket_id = 'anc-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='anc-media anon insert') THEN
    CREATE POLICY "anc-media anon insert" ON storage.objects
      FOR INSERT TO anon WITH CHECK (bucket_id = 'anc-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='anc-media anon update') THEN
    CREATE POLICY "anc-media anon update" ON storage.objects
      FOR UPDATE TO anon USING (bucket_id = 'anc-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='anc-media anon delete') THEN
    CREATE POLICY "anc-media anon delete" ON storage.objects
      FOR DELETE TO anon USING (bucket_id = 'anc-media');
  END IF;
END $$;
