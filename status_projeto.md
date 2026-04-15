# 📄 Status do Projeto: Portal ANC (Abril 2026)

Este documento resume o estado atual do projeto, as migrações realizadas e o funcionamento das principais "skills" e regras de negócio do sistema.

## 🏗️ Arquitetura Técnica
- **Frontend**: React + Vite (Javascript moderno).
- **Backend**: Supabase (PostgreSQL para dados e Auth para administração).
- **Estado**: Zustand (Controle de temas, autenticação e modo auditoria).
- **Navegação**: React Router v6.

## 🔄 Migração e Banco de Dados (Resumo)
O projeto passou por uma migração crítica para alinhar o banco de dados de produção (nomes de colunas legados) com o frontend moderno.

### Views de Compatibilidade (Bridge)
Para evitar falhas de listagem, criamos Views no Supabase que atuam como tradutores:
- `vw_notas_teen`: Espelha a tabela `Notas_Teen`.
- `vw_notas_soul`: Espelha a tabela `Notas_Soul`.
- `vw_notas`: União das duas tabelas para relatórios gerais.

> [!TIP]
> **Coluna Metadata**: O sistema agora tenta buscar as colunas `created_at`, `CreatedAt` ou `CreateAt` de forma resiliente para evitar erros de ordenação (400 Bad Request).

---

## 🔒 Sistema de Administração e Auditoria

### 1. Master Audit Mode
O sistema possui uma camada de proteção global chamada **Modo Auditoria**.
- **Senha Mestre**: `master2026`
- **Funcionamento**: Ao ativar o cadeado no topo, as rotas administrativas se tornam visíveis no menu lateral e os botões de Salvar/Editar/Excluir são habilitados em todo o portal.

### 2. Painel Admin Unificado
Todas as configurações de "geografia" e regras de negócio agora residem em `/admin/config`:
- **Provas**: Cadastro de nomes, tipos (Teen/Soul) e datas.
- **Regiões**: Gerenciamento da divisão macro.
- **Distritos**: Vinculados a Regiões.
- **Igrejas**: Vinculadas a Distritos.

---

## 🎨 Design & Estética (Premium)

### Temas Dinâmicos
O portal troca de tema visual automaticamente com base na rota ou seletores:
- **G148 Teen (Padrão)**: Tons azulados escuros, cores vibrantes (C1) e **fontes em Branco Puro (#FFFFFF)** para contraste.
- **Soul+ (Inspirado no Café)**: Tons amarelados/dourados e **fontes em Marrom Café Intenso (#281400)** para máxima legibilidade e elegância.

---

## 🚀 Guia de Manutenção (Skills)

### Como realizar o Deploy
1. Certifique-se de que o Vercel CLI está vinculado ao projeto correto via `npx vercel link`.
2. Execute `npx vercel deploy --prod`.

### Como adicionar novas tabelas admin
1. Crie a tabela no Supabase.
2. Adicione uma nova aba no componente `AdminConfig.jsx`.
3. Utilize o componente reutilizável `DimensionCRUD` passando a tabela, a chave primária (PK) e o campo principal.

### Sincronização com Google Sheets
- O código do **Google Apps Script** necessário para o espelhamento bidirecional está disponível na última aba do Painel Admin (**📜 Script**). Basta copiar e colar no painel de extensões da sua planilha oficial.

---

**Estado Atual: ESTÁVEL E FUNCIONAL.**
*Última atualização: 10 de Abril de 2026.*
