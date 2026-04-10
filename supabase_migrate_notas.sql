-- ================================================================
-- MIGRAÇÃO: Ajuste da tabela notas
-- Execute no SQL Editor do Supabase
-- https://supabase.com/dashboard/project/fecxszutgrotuksedyvd/sql/new
-- ================================================================

-- 1. Remove a coluna comunhao (substituída por nota_1000)
alter table notas drop column if exists comunhao;

-- 2. Altera nota para inteiro de 0 a 99 (sem casas decimais)
alter table notas alter column nota type integer using nota::integer;
alter table notas drop constraint if exists notas_nota_check;
alter table notas add constraint notas_nota_check check (nota >= 0 and nota <= 99);

-- 3. Adiciona as novas colunas
alter table notas add column if not exists nota_1000    text check (nota_1000 in ('Sim', 'Não', ''));
alter table notas add column if not exists verso        text check (verso     in ('Sim', 'Não', ''));
alter table notas add column if not exists discipulo    text check (discipulo in ('Sim', 'Não', ''));

-- observacoes já existe, só garante que está lá
alter table notas add column if not exists observacoes text;

-- ================================================================
-- Verificação: rode esta query para confirmar as colunas
-- ================================================================
-- select column_name, data_type
-- from information_schema.columns
-- where table_name = 'notas'
-- order by ordinal_position;
