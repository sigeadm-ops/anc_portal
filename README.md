# ANC App — Portal de Cadastros

React + Vite + Supabase + Google Sheets (espelho)

---

## 1. Configurar o banco (Supabase)

1. Acesse https://supabase.com/dashboard/project/fecxszutgrotuksedyvd
2. Clique em **SQL Editor** → **New query**
3. Cole todo o conteúdo de `supabase_schema.sql` e clique em **Run**
4. Pronto — todas as tabelas, triggers, índices e políticas de segurança criadas

---

## 2. Rodar localmente

```bash
cd C:\Projetos\anc-app
npm install
npm run dev
```

O `.env.local` já está configurado com as credenciais do Supabase.

Acesse: http://localhost:5173

---

## 3. Login admin

- URL: http://localhost:5173/admin/login
- Senha padrão: **admin2026**
- Troque a senha após o primeiro acesso em **Admin → Configurações**

---

## 4. Importar igrejas do sistema antigo

As igrejas ficam na tabela `igrejas` (Região / Distrito / Igreja / CodRef).
Você pode importar via CSV no painel Supabase:

1. Exporte a aba `tabIgrejas` do seu Google Sheets como CSV
2. No Supabase: **Table Editor → igrejas → Import data**
3. Mapeie as colunas: `regiao`, `distrito`, `igreja`, `codref`

---

## 5. Deploy na Vercel

```bash
# Instale a CLI da Vercel se ainda não tiver
npm i -g vercel

cd C:\Projetos\anc-app
vercel

# Na configuração, adicione as variáveis de ambiente:
# VITE_SUPABASE_URL     = https://fecxszutgrotuksedyvd.supabase.co
# VITE_SUPABASE_ANON_KEY = sb_publishable_GzL61qw6QQq9aRTag3GmLA_OHAXpiVd
# VITE_APPS_SCRIPT_URL  = (quando tiver o Apps Script configurado)
```

Ou conecte o repositório Git diretamente no painel da Vercel e adicione
as variáveis em **Project Settings → Environment Variables**.

---

## 6. Migrar dados do sistema antigo

Para migrar os dados já cadastrados no localStorage do sistema HTML:

1. Abra o sistema antigo no browser
2. Abra o console (F12)
3. Execute:

```js
// Exporta tudo do localStorage
const export = {
  bases: JSON.parse(localStorage.getItem('g148_bases_v1') || '[]'),
  membros: JSON.parse(localStorage.getItem('g148_membros_v1') || '[]'),
  pont: JSON.parse(localStorage.getItem('g148_pont_v1') || '[]'),
  provas: JSON.parse(localStorage.getItem('g148_provas_v1') || '[]'),
}
console.log(JSON.stringify(export))
```

4. Copie o JSON e use a função de importação (a ser criada) ou importe
   diretamente via Supabase Table Editor.

---

## 7. Configurar espelhamento no Google Sheets

1. Abra seu Google Sheets
2. Extensões → Apps Script
3. Cole o código de `Admin → Configurações` no portal
4. Implante como Web App (qualquer pessoa pode acessar)
5. Copie a URL e adicione em `VITE_APPS_SCRIPT_URL` no `.env.local`

---

## 8. Após o período de auditoria (maio)

Execute no SQL Editor do Supabase o bloco comentado no final do
`supabase_schema.sql` para remover as policies de delete/update público.

---

## Estrutura do projeto

```
src/
  api/
    supabase.js      — cliente Supabase
    sheetsApi.js     — espelhamento Google Sheets
    db.js            — CRUD genérico com espelho automático
  hooks/
    useTable.js      — React Query para qualquer tabela
    useIgrejas.js    — cascata Região > Distrito > Igreja
  layouts/
    AppLayout.jsx    — sidebar + topbar
  pages/
    Dashboard.jsx    — KPIs + mapa geográfico
    Bases.jsx        — CRUD de bases
    Membros.jsx      — cadastro em massa + lista
    Notas.jsx        — formulário de notas (Teen)
    NotasSoul.jsx    — formulário de notas (Soul+)
    Pontuacoes.jsx   — registro de pontuações
    Relatorios.jsx   — relatório filtrado com membros
    Provas.jsx       — gerenciar provas (admin)
    AdminConfig.jsx  — senha + Apps Script
    AdminLogin.jsx   — login admin
  store/
    authStore.js     — Zustand auth (sessão)
  utils/
    helpers.js       — formatação de datas, CPF, etc.
  index.css          — design system completo
  App.jsx            — roteamento
  main.jsx           — ponto de entrada
```
