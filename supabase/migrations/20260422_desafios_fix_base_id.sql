-- Fix: base_id usa IDs legíveis da tabela Bases (ex: 'B020', 'B001'),
-- não UUID. Alterar tipo de uuid → text nas tabelas de desafios.
ALTER TABLE desafios_registros ALTER COLUMN base_id TYPE text;
ALTER TABLE desafios_marcos    ALTER COLUMN base_id TYPE text;
