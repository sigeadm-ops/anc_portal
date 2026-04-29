-- ============================================================
-- Migração: Correção de categoria de Desafios cadastrados hoje
-- Objetivo: Mudar "Quartas de Poder" e outros desafios de 
--           categoria 'admin' para 'da' (Desafios da Associação)
--           Para todos os criados hoje em Soul+
-- ============================================================

-- 1. Listar os desafios que serão corrigidos (para auditoria)
-- SELECT id, codigo, nome, categoria, tipo, created_at
-- FROM desafios_catalogo
-- WHERE DATE(created_at) = CURRENT_DATE
--   AND tipo = 'Soul+'
--   AND categoria = 'admin';

-- 2. Corrigir a categoria: admin → da
UPDATE desafios_catalogo
SET categoria = 'da'
WHERE DATE(created_at) = CURRENT_DATE
  AND tipo = 'Soul+'
  AND categoria = 'admin';

-- Comentário de auditoria
INSERT INTO admin_activity_log (username, action, entity, description)
VALUES (
  'system',
  'update',
  'desafios_catalogo',
  'Correção automática: Desafios Soul+ categoria admin → da (criados hoje)'
)
ON CONFLICT DO NOTHING;
