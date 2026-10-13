-- ================================================================
-- Trava de lançamentos por região: início agendado
-- A trava (bloqueio_lancamentos = true) só vale a partir de
-- bloqueio_inicio; vazio = vale na hora.
-- ================================================================

ALTER TABLE "Regiao"
  ADD COLUMN IF NOT EXISTS bloqueio_inicio timestamptz;

-- Região Oeste: aberta até 13/10/2026 23:59, travada a partir de
-- 14/10/2026 00:00 (horário de Brasília)
UPDATE "Regiao"
SET bloqueio_lancamentos = true,
    bloqueio_inicio = '2026-10-14 00:00:00-03'
WHERE "Regiao" ILIKE 'oeste';
