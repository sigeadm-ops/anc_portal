-- ================================================================
-- ANC App — Scripts de importação via Staging Tables
-- Execute cada PASSO em ordem no SQL Editor do Supabase
--
-- ORDEM OBRIGATÓRIA:
--   1. regioes   ← importe o CSV direto (4 linhas, sem FK)
--   2. distritos ← importe o CSV direto (38 linhas, FK → regioes)
--   3. PASSO A   ← cria staging_igrejas → importa CSV → migra
--   4. PASSO B   ← cria staging_provas → importa datas.csv → migra
--   5. PASSO C   ← cria staging_bases → importa CSV → migra
--   6. PASSO D   ← cria staging_membros → importa CSV → migra
--   7. PASSO E   ← cria staging_notas → importa CSV → migra
--   8. PASSO F   ← cria staging_notas_soul → importa CSV → migra
-- ================================================================

-- ================================================================
-- PASSO A — IGREJAS
-- CSV: id_igrejas, id_distritos, Distritos, Igrejas, Templo, Pastor_Distrital
-- Problema: última linha do CSV tem dados inválidos (Vale,Pomerode,...)
-- ================================================================

-- A1. Criar staging (sem FK para aceitar a linha lixo)
drop table if exists staging_igrejas;
create table staging_igrejas (
  id_igrejas       text,
  id_distritos     text,   -- D01, D02... já são os IDs corretos
  distritos        text,   -- nome do distrito (redundante, ignorar)
  igrejas          text,   -- nome da igreja
  templo           text,
  pastor_distrital text
);
alter table staging_igrejas enable row level security;
create policy "staging_rw" on staging_igrejas for all to anon using (true) with check (true);

-- A2. >> IMPORTE O CSV de igrejas para staging_igrejas <<

-- A3. Migrar para igrejas (ignorando a linha lixo onde id não começa com I)
insert into igrejas (id, nome, distrito_id, tipo_templo, pastor_distrital)
select
  s.id_igrejas,
  s.igrejas,
  s.id_distritos,           -- já é D01, D02... referencia direta
  s.templo,
  s.pastor_distrital
from staging_igrejas s
where s.id_igrejas like 'I%'  -- filtra linha lixo (Vale, 208, etc.)
  and s.id_distritos like 'D%' -- garante FK válido
on conflict (nome, distrito_id) do update set
  tipo_templo      = excluded.tipo_templo,
  pastor_distrital = excluded.pastor_distrital;

-- A4. Verificar
select count(*) as total_igrejas from igrejas;
-- Linhas ignoradas (lixo):
select * from staging_igrejas where id_igrejas not like 'I%';

-- drop table staging_igrejas;  -- limpar após confirmar


-- ================================================================
-- PASSO B — PROVAS (arquivo: datas.csv)
-- CSV: tipo, data, titulo
-- ATENÇÃO: tipo no CSV = 'G148' e 'SOUL+' → converter para schema
-- ATENÇÃO: sem coluna id → gerar PG01..PG46 / PS01..PS11 automático
-- ================================================================

-- B1. Criar staging (3 colunas exatas do CSV)
drop table if exists staging_provas;
create table staging_provas (
  tipo   text,   -- 'G148' ou 'SOUL+'
  data   text,
  titulo text
);
alter table staging_provas enable row level security;
create policy "staging_rw_p" on staging_provas for all to anon using (true) with check (true);

-- B2. >> IMPORTE O CSV datas.csv para staging_provas <<

-- B3. Migrar (converte tipo + gera IDs PG01.../PS01... por ordem de data)
insert into provas (id, tipo, nome, data)
select
  case
    when tipo_norm = 'G148 Teen' then 'PG' || lpad(rn::text, 2, '0')
    else                               'PS' || lpad(rn::text, 2, '0')
  end      as id,
  tipo_norm,
  titulo   as nome,
  data_date
from (
  select
    case
      when upper(trim(s.tipo)) = 'G148'  then 'G148 Teen'
      when upper(trim(s.tipo)) = 'SOUL+' then 'Soul+'
      else s.tipo
    end                                                             as tipo_norm,
    s.titulo,
    s.data::date                                                    as data_date,
    row_number() over (
      partition by upper(trim(s.tipo))
      order by s.data::date, s.titulo
    )                                                               as rn
  from staging_provas s
  where s.titulo is not null and trim(s.titulo) != ''
) sub
on conflict (tipo, nome) do nothing;

-- B4. Verificar
select count(*) as total_provas from provas;
select tipo, count(*), min(id) as primeiro_id, max(id) as ultimo_id from provas group by tipo;

-- drop table staging_provas;


-- ================================================================
-- PASSO C — BASES (arquivo: bases.csv)
-- CSV: id_Base, Tipo, Base, id_regiao, Regiao, id_distritos, Distritos,
--      id_igrejas, Igrejas, Coord, Coord_Fone, Coord_Email, Prof,
--      Prof_Fone, Prof_Email, Midia, Midia_Fone, Midia_Email,
--      Data_Cad, Status, CreatedAt
-- Tipo: 'G148 Teen' ou 'Soul+'  (já no formato correto)
-- id_igrejas: I001... referência direta
-- Nota: id_Base NÃO é único globalmente — mesmo código em igrejas/tipos
--       diferentes (ex: B050 aparece 2x). UUID é gerado automaticamente.
-- ================================================================

drop table if exists staging_bases;
create table staging_bases (
  id_base      text,   -- id_Base no CSV → cod_origem (só auditoria)
  tipo         text,   -- 'G148 Teen' ou 'Soul+'
  base         text,   -- coluna "Base" no CSV → nome da base
  id_regiao    text,
  regiao       text,
  id_distritos text,
  distritos    text,
  id_igrejas   text,   -- I001... → referência direta a igrejas
  igrejas      text,   -- nome da igreja (redundante, ignorar na migração)
  coord        text,
  coord_fone   text,
  coord_email  text,
  prof         text,
  prof_fone    text,
  prof_email   text,
  midia        text,
  midia_fone   text,
  midia_email  text,
  data_cad     text,
  status       text,
  createdat    text    -- CreatedAt no CSV (ignorado — usa created_at do banco)
);
alter table staging_bases enable row level security;
create policy "staging_rw_b" on staging_bases for all to anon using (true) with check (true);

-- C2. >> IMPORTE O CSV de bases para staging_bases <<

-- C3. Migrar (UUID gerado automaticamente, cod_origem guarda o código original)
insert into bases (cod_origem, tipo, nome, igreja_id, coord, coord_fone, coord_email,
  prof, prof_fone, prof_email, midia, midia_fone, midia_email, data_cad, status)
select
  s.id_base,                         -- cod_origem para auditoria
  s.tipo,
  s.base,                            -- coluna "Base" no CSV → campo nome
  s.id_igrejas,                      -- referência direta à tabela igrejas
  s.coord,
  s.coord_fone,
  s.coord_email,
  s.prof,
  s.prof_fone,
  s.prof_email,
  s.midia,
  s.midia_fone,
  s.midia_email,
  case when s.data_cad ~ '^\d{4}-\d{2}-\d{2}' then s.data_cad::date else current_date end,
  coalesce(nullif(s.status, ''), 'Ativo')
from staging_bases s
where s.id_igrejas like 'I%'
  and s.tipo in ('G148 Teen', 'Soul+')
on conflict (nome, tipo, igreja_id) do update set
  cod_origem  = excluded.cod_origem,
  coord       = excluded.coord,
  coord_fone  = excluded.coord_fone,
  coord_email = excluded.coord_email,
  prof        = excluded.prof,
  status      = excluded.status;

-- C4. Verificar duplicatas de cod_origem (esperado — não é erro)
select * from vw_audit_bases_duplicadas;
select count(*) as total_bases from bases;
select tipo, count(*) from bases group by tipo;

-- drop table staging_bases;


-- ================================================================
-- PASSO D — MEMBROS
-- CSV: id_membros, Tipo, id_regiao, Regiao, id_distritos, Distritos,
--      id_igrejas, Igrejas, id_base, Base, Membros, Nasc, Fone, Email,
--      Endereco, Responsavel, Status, DataCad, CreateAt
--
-- Problemas:
--   - Tipo = 'G148' (não 'G148 Teen') → converter
--   - id_base = B079 etc. → resolver para UUID via (cod_origem + igreja_id + tipo)
-- ================================================================

drop table if exists staging_membros;
create table staging_membros (
  id_membros   text,   -- M001... → cod_origem
  tipo         text,   -- 'G148' ou 'Soul+'
  id_regiao    text,
  regiao       text,
  id_distritos text,
  distritos    text,
  id_igrejas   text,   -- I001... para ajudar a resolver base
  igrejas      text,
  id_base      text,   -- B001... → cod_origem da base
  base         text,
  membros      text,   -- nome do membro
  nasc         text,
  fone         text,
  email        text,
  endereco     text,
  responsavel  text,
  status       text,
  datacad      text,
  createat     text
);
alter table staging_membros enable row level security;
create policy "staging_rw_m" on staging_membros for all to anon using (true) with check (true);

-- D2. >> IMPORTE O CSV de membros para staging_membros <<

-- D3. Migrar (resolve base_id via cod_origem + igreja_id + tipo)
insert into membros (cod_origem, base_id, nome, nasc, fone, email, endereco,
  responsavel, status, data_cad)
select distinct on (s.id_membros, b.id)
  s.id_membros,
  b.id               as base_id,
  s.membros          as nome,
  case when s.nasc ~ '^\d{4}-\d{2}-\d{2}' then s.nasc::date else null end,
  nullif(trim(s.fone), ''),
  nullif(trim(s.email), ''),
  nullif(trim(s.endereco), ''),
  nullif(trim(s.responsavel), ''),
  coalesce(nullif(trim(s.status), ''), 'Ativo'),
  case when s.datacad ~ '^\d{4}-\d{2}-\d{2}' then s.datacad::date else current_date end
from staging_membros s
join bases b on
  b.cod_origem = s.id_base
  and b.igreja_id = s.id_igrejas
  and b.tipo = case when s.tipo = 'G148' then 'G148 Teen' else s.tipo end
where s.membros is not null and trim(s.membros) != '';

-- D4. Membros que NÃO encontraram base correspondente (problema de dados)
select s.id_membros, s.membros, s.id_base, s.id_igrejas, s.tipo
from staging_membros s
left join bases b on
  b.cod_origem = s.id_base
  and b.igreja_id = s.id_igrejas
  and b.tipo = case when s.tipo = 'G148' then 'G148 Teen' else s.tipo end
where b.id is null
  and s.membros is not null and trim(s.membros) != '';

select count(*) as total_membros from membros;

-- drop table staging_membros;


-- ================================================================
-- PASSO E — NOTAS (G148 Teen)
-- CSV: id_form, aba, Data, Titulo, Responsavel, id_regiao, Regiao,
--      id_distritos, Distritos, id_igrejas, Igrejas, id_base, Base,
--      id_membros, Membros, Nota, Observacoes, Versao, SalvoEm
-- ================================================================

drop table if exists staging_notas;
create table staging_notas (
  id_form      text,
  aba          text,   -- 'NOTAS' → tipo = 'G148 Teen'
  data         text,
  titulo       text,
  responsavel  text,
  id_regiao    text,
  regiao       text,
  id_distritos text,
  distritos    text,
  id_igrejas   text,
  igrejas      text,
  id_base      text,   -- B001... → cod_origem da base
  base         text,
  id_membros   text,
  membros      text,   -- nome_aluno
  nota         text,
  observacoes  text,
  versao       text,
  salvoemtext  text
);
alter table staging_notas enable row level security;
create policy "staging_rw_n" on staging_notas for all to anon using (true) with check (true);

-- E2. >> IMPORTE O CSV de notas para staging_notas <<

-- E3. Migrar (resolve base_id, tipo, prova via titulo+data)
insert into notas (id_form, base_id, prova_id, tipo, data, titulo, responsavel,
  nome_aluno, nota, observacoes, saved_at)
select
  s.id_form::uuid,
  b.id                                        as base_id,
  pr.id                                       as prova_id,
  'G148 Teen'                                 as tipo,
  case when s.data ~ '^\d{4}-\d{2}-\d{2}' then s.data::date else null end,
  s.titulo,
  s.responsavel,
  s.membros                                   as nome_aluno,
  case when s.nota ~ '^[0-9]+(\.[0-9]+)?$'
    then s.nota::numeric else null end,
  nullif(trim(s.observacoes), ''),
  case when s.salvoemtext ~ '^\d{4}-\d{2}-\d{2}'
    then s.salvoemtext::timestamptz else now() end
from staging_notas s
join bases b on
  b.cod_origem = s.id_base
  and b.igreja_id = s.id_igrejas
  and b.tipo = 'G148 Teen'
left join provas pr on
  pr.tipo = 'G148 Teen'
  and pr.nome = s.titulo
where s.membros is not null and trim(s.membros) != ''
  and s.id_form is not null;

-- E4. Verificar
select count(*) as total_notas_teen from notas where tipo = 'G148 Teen';

-- Notas sem base resolvida:
select distinct s.id_base, s.id_igrejas, s.base, s.igrejas
from staging_notas s
left join bases b on b.cod_origem = s.id_base and b.igreja_id = s.id_igrejas and b.tipo = 'G148 Teen'
where b.id is null;

-- drop table staging_notas;


-- ================================================================
-- PASSO F — NOTAS SOUL+ (notas_soul.csv)
-- CSV: id_form, aba, Data, Titulo, Responsavel, id_regiao, Regiao,
--      id_distritos, Distritos, id_igrejas, Igrejas, id_base, Base,
--      id_membros, Membros, Nota, Versao, SalvoEm
-- (sem coluna Observacoes)
-- ================================================================

drop table if exists staging_notas_soul;
create table staging_notas_soul (
  id_form      text,
  aba          text,   -- 'NOTAS_SOUL' → tipo = 'Soul+'
  data         text,
  titulo       text,
  responsavel  text,
  id_regiao    text,
  regiao       text,
  id_distritos text,
  distritos    text,
  id_igrejas   text,
  igrejas      text,
  id_base      text,
  base         text,
  id_membros   text,
  membros      text,
  nota         text,
  versao       text,
  salvoem      text
);
alter table staging_notas_soul enable row level security;
create policy "staging_rw_ns" on staging_notas_soul for all to anon using (true) with check (true);

-- F2. >> IMPORTE O CSV de notas_soul para staging_notas_soul <<

-- F3. Migrar
insert into notas (id_form, base_id, prova_id, tipo, data, titulo, responsavel,
  nome_aluno, nota, saved_at)
select
  s.id_form::uuid,
  b.id                                        as base_id,
  pr.id                                       as prova_id,
  'Soul+'                                     as tipo,
  case when s.data ~ '^\d{4}-\d{2}-\d{2}' then s.data::date else null end,
  s.titulo,
  s.responsavel,
  s.membros                                   as nome_aluno,
  case when s.nota ~ '^[0-9]+(\.[0-9]+)?$'
    then s.nota::numeric else null end,
  case when s.salvoem ~ '^\d{4}-\d{2}-\d{2}'
    then s.salvoem::timestamptz else now() end
from staging_notas_soul s
join bases b on
  b.cod_origem = s.id_base
  and b.igreja_id = s.id_igrejas
  and b.tipo = 'Soul+'
left join provas pr on
  pr.tipo = 'Soul+'
  and pr.nome = s.titulo
where s.membros is not null and trim(s.membros) != ''
  and s.id_form is not null;

-- F4. Verificar
select count(*) as total_notas_soul from notas where tipo = 'Soul+';

-- drop table staging_notas_soul;


-- ================================================================
-- VERIFICAÇÃO FINAL
-- ================================================================
select 'regioes'    as tabela, count(*) as total from regioes
union all
select 'distritos',  count(*) from distritos
union all
select 'igrejas',    count(*) from igrejas
union all
select 'provas',     count(*) from provas
union all
select 'bases',      count(*) from bases
union all
select 'membros',    count(*) from membros
union all
select 'notas',      count(*) from notas;

-- Checar bases duplicadas por cod_origem (deve retornar 0 se migração OK)
select count(*) as duplicatas_cod_origem from vw_audit_bases_duplicadas;
