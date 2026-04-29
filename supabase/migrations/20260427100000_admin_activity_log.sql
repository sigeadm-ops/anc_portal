-- ============================================================
-- Migração: log de atividades administrativas
-- Objetivo: rastrear login, logout e ações sensíveis do admin
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username    text NOT NULL DEFAULT 'admin',
  action      text NOT NULL,           -- ex: login, logout, create, update, delete
  entity      text,                    -- ex: membros, bases, notas
  description text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- Índices para consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_activity_log_created
  ON admin_activity_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_username
  ON admin_activity_log(username, created_at DESC);

-- RLS: qualquer usuário pode inserir (para o app logar sem auth Supabase)
-- Leitura apenas via service role (admin) ou anon com chave de projeto
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Permite inserção pública (o frontend loga sem auth supabase)
CREATE POLICY "allow_insert_activity_log"
  ON admin_activity_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Leitura liberada para anon (já está protegida pela chave anon do projeto)
CREATE POLICY "allow_read_activity_log"
  ON admin_activity_log FOR SELECT
  TO anon, authenticated
  USING (true);
