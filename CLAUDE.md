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
