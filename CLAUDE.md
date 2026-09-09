# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aura System is a SaaS management platform for aesthetic clinics (clínicas de estética). It's a multi-tenant system with subscription-based access control and role-based permissions.

## Architecture

**Monorepo with two applications:**

1. **Frontend** (root `/`) - React 19 + Vite + TypeScript
   - Entry: `index.tsx` → `App.tsx` (routing)
   - Pages: `/pages/*.tsx` - Full page components
   - Components: `/components/*.tsx` - Reusable UI
   - State: `/context/AppContext.tsx` - Global state with React Context
   - API Client: `/services/api.ts` - HTTP client for backend
   - AI: `/services/geminiService.ts` - Google Gemini integration

2. **Backend** (`/aura-backend`) - Next.js 15 + Prisma + Supabase
   - API Routes: `/src/app/api/*/route.ts` (Next.js App Router)
   - Database: `/prisma/schema.prisma` (PostgreSQL via Supabase)
   - Auth: `/src/lib/auth.ts` - JWT authentication
   - RBAC: `/src/lib/rbac.ts` - Role-based access control
   - Guards: `/src/lib/apiGuards.ts` - API middleware
   - Plan Permissions: `/src/lib/planPermissions.ts`

## Common Commands

```bash
# Start both servers (Windows)
.\start-all.bat

# Or using PowerShell
.\start-dev.ps1

# Frontend only (port 3000)
npm run dev

# Backend only (port 3001)
cd aura-backend && npm run dev

# Database commands
cd aura-backend
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:studio     # Open Prisma Studio GUI
npm run db:seed       # Seed database with initial data

# Linting
cd aura-backend && npm run lint
```

## Key Types and Roles

Types are defined in `/types.ts`. User roles (`UserRole` enum):
- `OWNER` - SaaS platform owner
- `ADMIN` - Clinic administrator
- `RECEPTIONIST` - Limited access to schedule/patients
- `ESTHETICIAN` - Professional/practitioner
- `PATIENT` - Client-facing portal access

Subscription plans control module access via `PLAN_PERMISSIONS` in `/constants.ts`.

## Multi-tenancy

All data is scoped by `companyId`. The frontend reads company from authenticated user context. Backend API routes validate company ownership via JWT claims.

## Environment Variables

Frontend (`.env.local`):
- `VITE_API_URL` - Backend URL (default: http://localhost:3001)
- `GEMINI_API_KEY` - For AI features

Backend (`aura-backend/.env`):
- `DATABASE_URL` - Supabase PostgreSQL connection
- `DIRECT_URL` - Direct database connection for migrations
- `JWT_SECRET` - Token signing secret

## Code Patterns

- Frontend uses HashRouter for client-side routing
- Backend uses Next.js App Router with route handlers
- All API responses follow `{ success: boolean, data?: T, error?: string }`
- Prisma is the ORM - always run `db:generate` after schema changes
- Portuguese is used for UI labels and some variable names (Brazilian market)

## Engineering Principles (OBRIGATÓRIO seguir sempre)

### Usar bibliotecas consolidadas — nunca reinventar a roda
- **Antes de escrever qualquer utilitário**, verificar se existe uma biblioteca npm madura para isso.
- Exemplos obrigatórios neste projeto:
  - CSV parsing → `papaparse` (não escrever parser manual)
  - Validação de schema/dados → `zod` (já instalado — usar em todas as rotas)
  - Datas → `date-fns` se precisar de manipulação avançada
  - Validação de CPF/CNPJ → `cpf-cnpj-validator` ou `@brazilian-utils/br-validators`
  - Validação de telefone BR → `libphonenumber-js` ou regex padrão E.164
  - Email → regex padrão do `zod` (`.email()`) — nunca escrever regex de email manual
  - Hash de senha → `bcryptjs` (já instalado)
  - UUID/CUID → `crypto.randomUUID()` nativo ou Prisma `@default(cuid())`

### Utilitários e componentes globais — usar sempre, nunca redefinir localmente
Os seguintes utilitários e sistemas já existem. Antes de escrever qualquer código novo, verificar aqui primeiro:

**Frontend — Utilitários (`/utils/formatUtils.ts`)**
- `formatCurrency(value)` — formatar valores em R$
- `formatDate(date)` / `formatDateTime(date)` / `formatTime(date)` — datas e horas
- `getAvatarConfig(name)` — retorna `{ bg, text }` para gradiente de avatar
- `getAvatarInitials(name)` — retorna iniciais do nome (ex: "JS")
- `getDaysDifference(d1, d2)` — diferença em dias entre datas

**Frontend — Sistema de Dialog (`/context/DialogContext.tsx`)**
- `useDialog()` — hook que expõe `confirm()` e `showAlert()`
- `confirm(message, options?)` — modal de confirmação (retorna `Promise<boolean>`)
- `showAlert(message, options?)` — modal de alerta/erro/sucesso
- **NUNCA usar `window.confirm()` ou `alert()`** — sempre usar `useDialog()`
- `DialogProvider` já está no `App.tsx` — disponível em toda a aplicação

### Não duplicar código
- Lógica compartilhada entre rotas vai em `/src/lib/` (utilitários) ou `/src/lib/validations/` (schemas Zod).
- Componentes UI reutilizáveis vão em `/components/` — nunca copiar JSX entre páginas.
- Se o mesmo bloco aparece em 2+ lugares, extrair imediatamente.

### Pensar antes de criar
- Sempre verificar se já existe uma rota, componente, ou função que faz o que precisa antes de criar uma nova.
- Grep no codebase primeiro: `grep -r "nomeDaFunção"` antes de implementar.
- Preferir estender o que existe a criar do zero.

### Qualidade de código
- Sem `any` no TypeScript — sempre tipagem explícita ou `unknown` com type guard.
- Funções com responsabilidade única: se uma função faz mais de uma coisa, extrair.
- Nomes descritivos em inglês para código; português apenas para mensagens ao usuário e UI.
- Erros sempre tratados e logados; nunca silenciar `catch {}` sem motivo.

### Segurança
- Toda entrada do usuário validada com Zod antes de tocar o banco.
- Nunca confiar em dados do frontend: revalidar `companyId`, permissões e ownership no backend.
- Sem SQL raw quando Prisma resolve — usar `prisma.$queryRaw` apenas quando necessário e com parâmetros tipados.

### Tratamento de erros (OBRIGATÓRIO)
- **Todo erro deve ser comunicado ao usuário** — nunca deixar uma ação falhar silenciosamente.
- Backend: o bloco `catch` genérico SEMPRE retorna `{ error: "Erro inesperado." }` com status 500. Erros previsíveis (FK constraint, não encontrado, sem permissão) retornam mensagens descritivas com o status HTTP correto (409, 404, 403).
- Frontend: após qualquer chamada de API que pode falhar (delete, save, import), verificar o resultado e exibir `alert(result.error ?? 'Erro inesperado.')` se `!result.success`. Nunca ignorar o retorno de funções assíncronas de mutação.
- Antes de deletar um registro, verificar no backend se existem registros filhos vinculados (FK) e retornar 409 com mensagem clara — não deixar o banco estourar erro 500.

## Deploy Rules (OBRIGATÓRIO — sem exceções)

**Nenhum deploy pode ocorrer com erros de compilação ou testes falhando. Sem exceções.**
- "São só testes" não é justificativa. Testes com erro indicam código quebrado ou tipo errado.
- "O erro já existia antes" não é justificativa. Se passou pela nossa mão, é nossa responsabilidade.
- Erros pré-existentes devem ser corrigidos antes do deploy, nunca ignorados.

**Backend — checklist obrigatório antes de `vercel --prod --yes` em `aura-backend/`:**
1. `npx tsc --noEmit` — zero erros (incluindo arquivos de teste em `__tests__/`)
2. `npm run test:ci` — todos os testes passando

**Frontend — checklist obrigatório antes de `vercel --prod --yes` na raiz:**
1. `npx tsc --noEmit` — zero erros

## Git Push Rules (OBRIGATÓRIO — sem exceções)

**Nenhuma versão pode subir para o git (push) com testes falhando.**
- Aplicado via hook `pre-push` do Husky (`.husky/pre-push`), instalado automaticamente em `npm install` (script `prepare`) — roda em QUALQUER `git push`, seja pelo Claude Code ou manualmente pelo terminal.
- O hook roda `npm run test:unit` (frontend `vitest run` + backend `npm run test:ci`). Se qualquer teste falhar, o push é bloqueado.
- `git push --no-verify` pula a checagem — usar apenas em emergência real, nunca como atalho de rotina.
- `test-all.sh --unit-only` também roda frontend + backend (antes só rodava o backend — corrigido).

## Testing Rules

- Toda nova rota de API ou lógica de negócio exige testes unitários em `aura-backend/src/__tests__/`
- Usar Vitest + mocks do Prisma (padrão já estabelecido nos arquivos existentes)
- Testes de status/validação são obrigatórios: sucesso, erro de validação, casos de limite (ex: sessão esgotada), e transições inválidas
