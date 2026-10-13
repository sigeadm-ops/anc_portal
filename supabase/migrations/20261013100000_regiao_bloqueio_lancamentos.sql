-- ================================================================
-- Trava de lançamentos por região
-- Enquanto bloqueio_lancamentos = true, o portal público não grava
-- nada (notas, membros, bases, desafios, discípulos, batismos, fotos)
-- das bases dessa região; só o administrativo altera.
-- Liga/desliga em Configurações Gerais → Regiões.
-- ================================================================

ALTER TABLE "Regiao"
  ADD COLUMN IF NOT EXISTS bloqueio_lancamentos boolean NOT NULL DEFAULT false;

-- Premiação da região Oeste (semana de 13/10/2026)
UPDATE "Regiao"
SET bloqueio_lancamentos = true
WHERE "Regiao" ILIKE 'oeste';
