-- Adiciona mes_ref ao catálogo de desafios:
-- define em qual mês do ano (1-12) o desafio mensal deve ser cumprido.
-- O trimestre é derivado: ceil(mes_ref / 3).
ALTER TABLE desafios_catalogo
  ADD COLUMN IF NOT EXISTS mes_ref smallint CHECK (mes_ref BETWEEN 1 AND 12);
