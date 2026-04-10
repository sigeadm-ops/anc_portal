-- ================================================================
-- ANC App — Import de Igrejas via Staging Table
--
-- PROBLEMA: o CSV de igrejas tem o NOME do distrito (ex: "Pomerode")
-- na coluna id_distritos, não o código (D01). Além disso, tem colunas
-- extras (Pastor_Distrital) que precisam ser mapeadas.
--
-- SOLUÇÃO: importar o CSV numa tabela staging sem FKs, depois
-- resolver os nomes → IDs via JOIN e popular a tabela real.
--
-- ORDEM DE EXECUÇÃO:
--   1. Execute o PASSO 1 para criar a staging table
--   2. Importe o CSV de igrejas nesta staging table pelo Supabase
--   3. Execute o PASSO 2 para mover os dados para a tabela real
--   4. Execute o PASSO 3 para limpar e verificar
-- ================================================================

-- ── PASSO 1: Criar tabela staging (sem FKs) ──────────────────────
-- Execute ANTES de importar o CSV
drop table if exists staging_igrejas;

create table staging_igrejas (
  id_igrejas       text,
  id_distritos     text,   -- contém o NOME do distrito (ex: "Pomerode")
  distritos        text,   -- coluna duplicada com nome do distrito
  igrejas          text,   -- nome da igreja
  templo           text,   -- tipo: 'Igreja', 'Grupo', etc.
  pastor_distrital text
  -- adicione aqui outras colunas do CSV se houver mais
);

-- GRANT para importação via Supabase dashboard
alter table staging_igrejas enable row level security;
create policy "staging_rw" on staging_igrejas for all to anon using (true) with check (true);

-- ================================================================
-- >> AGORA IMPORTE O CSV para a tabela "staging_igrejas" <<
-- Use: Supabase → Table Editor → staging_igrejas → Import Data
-- ================================================================

-- ── PASSO 2: Transferir da staging para igrejas (resolvendo FK) ──
-- Execute APÓS importar o CSV

insert into igrejas (id, nome, distrito_id, tipo_templo, pastor_distrital)
select
  s.id_igrejas,
  s.igrejas,
  d.id               as distrito_id,   -- resolve nome → código (D01, D02...)
  s.templo,
  s.pastor_distrital
from staging_igrejas s
join distritos d
  on d.nome = coalesce(nullif(trim(s.id_distritos), ''), trim(s.distritos))
on conflict (nome, distrito_id) do update set
  tipo_templo      = excluded.tipo_templo,
  pastor_distrital = excluded.pastor_distrital;

-- ── PASSO 3: Verificar resultado e limpar ────────────────────────
-- Quantidade importada
select count(*) as total_igrejas from igrejas;

-- Verificar se sobrou alguma linha que NÃO casou com um distrito
select s.*
from staging_igrejas s
left join distritos d
  on d.nome = coalesce(nullif(trim(s.id_distritos), ''), trim(s.distritos))
where d.id is null;
-- Se retornar linhas: o nome do distrito no CSV não casou com nenhum
-- registro em distritos. Verifique a grafia exata.

-- Limpar staging após confirmar que está tudo ok
-- drop table staging_igrejas;
