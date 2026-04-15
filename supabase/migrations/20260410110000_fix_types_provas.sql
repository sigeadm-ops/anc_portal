-- ================================================================
-- Migração: Corrigir tipos e nomes na tabela Provas
-- ================================================================

-- 1. Renomear colunas para minúsculo (estilo padrão do projeto)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Provas' AND column_name = 'Provas') THEN
    ALTER TABLE "Provas" RENAME COLUMN "Provas" TO "nome";
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Provas' AND column_name = 'Data') THEN
    ALTER TABLE "Provas" RENAME COLUMN "Data" TO "data";
  END IF;
END $$;

-- 2. Converter coluna 'data' de TEXT para DATE
-- Assume o formato DD/MM/YYYY que estava sendo usado no Excel/Sheets
ALTER TABLE "Provas" 
  ALTER COLUMN "data" TYPE DATE 
  USING to_date("data", 'DD/MM/YYYY');

-- 3. Renomear a tabela para minúsculo (opcional, para alinhar com o esquema ideal)
-- Se preferir manter Provas, comente a linha abaixo.
-- ALTER TABLE "Provas" RENAME TO "provas";
