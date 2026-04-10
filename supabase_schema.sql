-- ================================================================
-- ANC App — Schema Supabase v2 (Normalizado com FK)
-- Execute no SQL Editor do painel Supabase
--
-- IDs legíveis por tabela:
--   regioes    → R01, R02...      (text PK — estáveis, centralizados)
--   distritos  → D01, D02...      (text PK — estáveis, centralizados)
--   igrejas    → I001, I002...    (text PK — estáveis, centralizados)
--   provas     → PG01, PG02... (G148 Teen) / PS01, PS02... (Soul+)
--   bases      → uuid             (IDs de origem não são globalmente únicos!)
--   membros    → uuid             (IDs de origem não são globalmente únicos!)
--   notas      → uuid             (gerado automaticamente)
--   pontuacoes → uuid             (gerado automaticamente)
--
-- Campos cod_origem em bases e membros guardam o código legível original
-- (ex: B050, M128) apenas para fins de auditoria de migração.
-- ================================================================

-- ── TABELAS DIMENSÃO ─────────────────────────────────────────────

create table if not exists regioes (
  id   text primary key,              -- ex: R01
  nome text not null unique
);

create table if not exists distritos (
  id        text primary key,         -- ex: D01
  nome      text not null,
  regiao_id text not null references regioes(id) on delete restrict,
  unique(nome, regiao_id)
);

-- ── IGREJAS ──────────────────────────────────────────────────────
create table if not exists igrejas (
  id               text primary key,  -- ex: I001
  nome             text not null,
  distrito_id      text not null references distritos(id) on delete restrict,
  codref           text,
  tipo_templo      text,              -- 'Igreja', 'Grupo', etc.
  pastor_distrital text,
  unique(nome, distrito_id)
);

-- ── BASES ────────────────────────────────────────────────────────
-- UUID como PK porque os IDs de origem (B050 etc.) NÃO são globalmente
-- únicos — o mesmo código aparece em igrejas/tipos diferentes.
create table if not exists bases (
  id          uuid primary key default gen_random_uuid(),
  cod_origem  text,                   -- ex: B050 — apenas para auditoria de migração
  tipo        text not null check (tipo in ('G148 Teen', 'Soul+')),
  nome        text not null,
  igreja_id   text not null references igrejas(id) on delete restrict,
  coord       text,
  coord_fone  text,
  coord_email text,
  prof        text,
  prof_fone   text,
  prof_email  text,
  midia       text,
  midia_fone  text,
  midia_email text,
  data_cad    date default current_date,
  status      text default 'Ativo' check (status in ('Ativo', 'Inativo')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(nome, tipo, igreja_id)       -- restrição real de negócio
);

-- ── MEMBROS (uuid — gerado automaticamente) ──────────────────────
-- UUID como PK porque os IDs de origem (M128 etc.) NÃO são globalmente únicos.
create table if not exists membros (
  id          uuid primary key default gen_random_uuid(),
  cod_origem  text,                   -- ex: M128 — apenas para auditoria de migração
  base_id     uuid not null references bases(id) on delete restrict,
  nome        text not null,
  nasc        date,
  fone        text,
  email       text,
  endereco    text,
  responsavel text,
  cpf         text,
  rg          text,
  camiseta    text,
  status      text default 'Ativo' check (status in ('Ativo', 'Inativo')),
  data_cad    date default current_date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── PROVAS ───────────────────────────────────────────────────────
create table if not exists provas (
  id         text primary key,        -- ex: PG01 (Teen) / PS01 (Soul+)
  tipo       text not null check (tipo in ('G148 Teen', 'Soul+')),
  nome       text not null,
  data       date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tipo, nome)
);

-- ── NOTAS (uuid — gerado automaticamente) ────────────────────────
create table if not exists notas (
  id          uuid primary key default gen_random_uuid(),
  id_form     uuid not null,
  base_id     uuid not null references bases(id) on delete restrict,
  prova_id    text references provas(id) on delete set null,
  tipo        text check (tipo in ('G148 Teen', 'Soul+')),
  data        date,
  titulo      text,
  responsavel text,
  nome_aluno  text not null,
  nota        numeric(4,1) check (nota >= 0 and nota <= 99),
  nota_1000   text check (nota_1000 in ('Sim', 'Não')),
  verso       text check (verso     in ('Sim', 'Não')),
  discipulo   text check (discipulo in ('Sim', 'Não')),
  comunhao    text,
  observacoes text,
  saved_at    timestamptz default now(),
  created_at  timestamptz default now()
);

-- ── PONTUACOES (uuid — gerado automaticamente) ───────────────────
create table if not exists pontuacoes (
  id         uuid primary key default gen_random_uuid(),
  igreja_id  text not null references igrejas(id) on delete restrict,
  data       date,
  tipo       text,
  pontos     numeric,
  status     text default 'Pendente' check (status in ('Pendente', 'Aprovado', 'Rejeitado')),
  obs        text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ================================================================
-- VIEWS — dados desnormalizados para leitura no frontend
-- ================================================================

create or replace view vw_bases as
select
  b.id, b.cod_origem, b.tipo, b.nome, b.status, b.data_cad,
  b.coord,  b.coord_fone,  b.coord_email,
  b.prof,   b.prof_fone,   b.prof_email,
  b.midia,  b.midia_fone,  b.midia_email,
  b.created_at, b.updated_at,
  b.igreja_id,
  i.nome             as igreja,
  i.codref,
  i.tipo_templo,
  i.pastor_distrital,
  i.distrito_id,
  d.nome        as distrito,
  d.regiao_id,
  r.nome        as regiao
from bases b
join igrejas   i on i.id = b.igreja_id
join distritos d on d.id = i.distrito_id
join regioes   r on r.id = d.regiao_id;

create or replace view vw_membros as
select
  m.id, m.cod_origem, m.nome, m.status, m.data_cad,
  m.nasc, m.fone, m.email, m.endereco,
  m.responsavel, m.cpf, m.rg, m.camiseta,
  m.created_at, m.updated_at,
  m.base_id,
  b.nome        as nome_base,
  b.tipo        as tipo,
  b.igreja_id,
  i.nome        as nome_igreja,
  i.distrito_id,
  d.nome        as distrito,
  d.regiao_id,
  r.nome        as regiao
from membros m
join bases     b on b.id = m.base_id
join igrejas   i on i.id = b.igreja_id
join distritos d on d.id = i.distrito_id
join regioes   r on r.id = d.regiao_id;

create or replace view vw_pontuacoes as
select
  p.id, p.data, p.tipo, p.pontos, p.status, p.obs,
  p.created_at, p.updated_at,
  p.igreja_id,
  i.nome        as nome_igreja,
  i.distrito_id,
  d.nome        as distrito,
  d.regiao_id,
  r.nome        as regiao
from pontuacoes p
join igrejas   i on i.id = p.igreja_id
join distritos d on d.id = i.distrito_id
join regioes   r on r.id = d.regiao_id;

create or replace view vw_notas as
select
  n.id, n.id_form, n.prova_id, n.tipo, n.data, n.titulo, n.responsavel,
  n.nome_aluno, n.nota, n.nota_1000, n.verso, n.discipulo,
  n.comunhao, n.observacoes, n.saved_at, n.created_at,
  n.base_id,
  b.nome        as base,
  b.tipo        as tipo_base,
  b.igreja_id,
  i.nome        as igreja,
  i.distrito_id,
  d.nome        as distrito,
  d.regiao_id,
  r.nome        as regiao,
  -- Dados da prova (quando vinculada)
  pr.nome       as prova_nome,
  pr.tipo       as prova_tipo
from notas n
join bases     b  on b.id  = n.base_id
join igrejas   i  on i.id  = b.igreja_id
join distritos d  on d.id  = i.distrito_id
join regioes   r  on r.id  = d.regiao_id
left join provas pr on pr.id = n.prova_id;

-- ── AUDITORIA: detecta IDs de origem duplicados após migração ────
create or replace view vw_audit_bases_duplicadas as
select
  b.cod_origem,
  count(*)               as total,
  array_agg(b.id::text)  as uuids,
  array_agg(i.nome)      as igrejas,
  array_agg(b.tipo)      as tipos
from bases b
join igrejas i on i.id = b.igreja_id
where b.cod_origem is not null
group by b.cod_origem
having count(*) > 1;

-- ================================================================
-- FUNÇÃO + TRIGGERS: atualiza updated_at automaticamente
-- ================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists bases_updated_at      on bases;
drop trigger if exists membros_updated_at    on membros;
drop trigger if exists provas_updated_at     on provas;
drop trigger if exists pontuacoes_updated_at on pontuacoes;

create trigger bases_updated_at
  before update on bases      for each row execute function update_updated_at();
create trigger membros_updated_at
  before update on membros    for each row execute function update_updated_at();
create trigger provas_updated_at
  before update on provas     for each row execute function update_updated_at();
create trigger pontuacoes_updated_at
  before update on pontuacoes for each row execute function update_updated_at();

-- ================================================================
-- ÍNDICES úteis
-- ================================================================
create index if not exists idx_distritos_regiao   on distritos  (regiao_id);
create index if not exists idx_igrejas_distrito   on igrejas    (distrito_id);
create index if not exists idx_bases_igreja       on bases      (igreja_id);
create index if not exists idx_bases_tipo         on bases      (tipo);
create index if not exists idx_bases_tipo_igreja  on bases      (tipo, igreja_id);
create index if not exists idx_membros_base       on membros    (base_id);
create index if not exists idx_membros_status     on membros    (base_id, status);
create index if not exists idx_membros_nome       on membros    (nome);
create index if not exists idx_notas_base         on notas      (base_id);
create index if not exists idx_notas_id_form      on notas      (id_form);
create index if not exists idx_notas_tipo_base    on notas      (tipo, base_id);
create index if not exists idx_notas_prova        on notas      (prova_id);
create index if not exists idx_pont_igreja        on pontuacoes (igreja_id);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================
alter table regioes    enable row level security;
alter table distritos  enable row level security;
alter table igrejas    enable row level security;
alter table bases      enable row level security;
alter table membros    enable row level security;
alter table provas     enable row level security;
alter table notas      enable row level security;
alter table pontuacoes enable row level security;

-- Remove policies anteriores
do $$ declare r record;
begin
  for r in select schemaname, tablename, policyname
    from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ── LEITURA PÚBLICA ──────────────────────────────────────────────
create policy "leitura_publica" on regioes    for select to anon using (true);
create policy "leitura_publica" on distritos  for select to anon using (true);
create policy "leitura_publica" on igrejas    for select to anon using (true);
create policy "leitura_publica" on bases      for select to anon using (true);
create policy "leitura_publica" on membros    for select to anon using (true);
create policy "leitura_publica" on provas     for select to anon using (true);
create policy "leitura_publica" on notas      for select to anon using (true);
create policy "leitura_publica" on pontuacoes for select to anon using (true);

-- Permissão de SELECT nas views para anon
grant select on vw_bases                  to anon;
grant select on vw_membros                to anon;
grant select on vw_pontuacoes             to anon;
grant select on vw_notas                  to anon;
grant select on vw_audit_bases_duplicadas to anon;

-- ── MODO AUDITORIA: escrita pública ─────────────────────────────
create policy "escrita_regioes"    on regioes    for all to anon using (true) with check (true);
create policy "escrita_distritos"  on distritos  for all to anon using (true) with check (true);
create policy "escrita_igrejas"    on igrejas    for all to anon using (true) with check (true);
create policy "escrita_bases"      on bases      for all to anon using (true) with check (true);
create policy "escrita_membros"    on membros    for all to anon using (true) with check (true);
create policy "escrita_notas"      on notas      for all to anon using (true) with check (true);
create policy "escrita_pontuacoes" on pontuacoes for all to anon using (true) with check (true);
create policy "escrita_provas"     on provas     for all to anon using (true) with check (true);

-- ================================================================
-- EXEMPLO DE POPULAÇÃO (adapte aos seus dados)
-- ================================================================
-- INSERT INTO regioes (id, nome) VALUES
--   ('R01', 'Região Sul'),
--   ('R02', 'Região Norte');
--
-- INSERT INTO distritos (id, nome, regiao_id) VALUES
--   ('D01', 'Distrito Central', 'R01'),
--   ('D02', 'Distrito Leste',   'R01');
--
-- INSERT INTO igrejas (id, nome, distrito_id) VALUES
--   ('I001', 'Igreja Exemplo', 'D01'),
--   ('I002', 'Igreja Beta',    'D01');
--
-- INSERT INTO bases (cod_origem, tipo, nome, igreja_id) VALUES
--   ('B001', 'G148 Teen', 'Base Águias', 'I001'),
--   ('B002', 'Soul+',     'Base Luz',    'I001');
--
-- INSERT INTO provas (id, tipo, nome, data) VALUES
--   ('PG01', 'G148 Teen', 'BEP 1ª Fase',     '2025-04-10'),
--   ('PS01', 'Soul+',     'Provinha Soul+ 1', '2025-04-10');

-- ================================================================
-- APÓS O PERÍODO DE AUDITORIA: restrinja escrita pública
-- ================================================================
-- drop policy "escrita_bases"      on bases;
-- drop policy "escrita_membros"    on membros;
-- drop policy "escrita_notas"      on notas;
-- drop policy "escrita_pontuacoes" on pontuacoes;
-- drop policy "escrita_igrejas"    on igrejas;
-- drop policy "escrita_distritos"  on distritos;
-- drop policy "escrita_regioes"    on regioes;
-- ================================================================
