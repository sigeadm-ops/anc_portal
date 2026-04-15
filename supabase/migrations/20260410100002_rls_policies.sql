-- ================================================================
-- 1. HABILITAR RLS
-- ================================================================

ALTER TABLE regioes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE distritos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE igrejas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bases      ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros    ENABLE ROW LEVEL SECURITY;
ALTER TABLE provas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontuacoes ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 2. LIMPAR POLÍTICAS EXISTENTES
-- ================================================================

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname
    FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE FORMAT('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ================================================================
-- 3. POLÍTICAS DE LEITURA (Público/Anon)
-- ================================================================

CREATE POLICY "leitura_publica" ON regioes    FOR SELECT TO anon USING (TRUE);
CREATE POLICY "leitura_publica" ON distritos  FOR SELECT TO anon USING (TRUE);
CREATE POLICY "leitura_publica" ON igrejas    FOR SELECT TO anon USING (TRUE);
CREATE POLICY "leitura_publica" ON bases      FOR SELECT TO anon USING (TRUE);
CREATE POLICY "leitura_publica" ON membros    FOR SELECT TO anon USING (TRUE);
CREATE POLICY "leitura_publica" ON provas     FOR SELECT TO anon USING (TRUE);
CREATE POLICY "leitura_publica" ON notas      FOR SELECT TO anon USING (TRUE);
CREATE POLICY "leitura_publica" ON pontuacoes FOR SELECT TO anon USING (TRUE);

-- Permissão de SELECT nas views
GRANT SELECT ON vw_bases                  TO anon;
GRANT SELECT ON vw_membros                TO anon;
GRANT SELECT ON vw_pontuacoes             TO anon;
GRANT SELECT ON vw_notas                  TO anon;
GRANT SELECT ON vw_audit_bases_duplicadas TO anon;

-- ================================================================
-- 4. POLÍTICAS DE ESCRITA (Modo Auditoria/Público)
-- ================================================================

CREATE POLICY "escrita_regioes"    ON regioes    FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "escrita_distritos"  ON distritos  FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "escrita_igrejas"    ON igrejas    FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "escrita_bases"      ON bases      FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "escrita_membros"    ON membros    FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "escrita_notas"      ON notas      FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "escrita_pontuacoes" ON pontuacoes FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "escrita_provas"     ON provas     FOR ALL TO anon USING (TRUE) WITH CHECK (TRUE);
