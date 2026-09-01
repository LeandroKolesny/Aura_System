# Aura System — Stack Técnico Completo

> Plataforma SaaS de gestão para clínicas de estética. Arquitetura monorepo com frontend React e backend Next.js, ambos deployados na Vercel.

---

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                    │
│              React 19 + Vite  —  aura-system-mu.vercel.app  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP / REST
┌────────────────────────────▼────────────────────────────────┐
│                   BACKEND (Next.js API)                     │
│          Next.js 15  —  aura-backend-api.vercel.app         │
└──────┬────────────┬──────────────┬──────────────────────────┘
       │            │              │
   Prisma ORM   Serviços      Rate Limit
       │        externos       (Redis)
┌──────▼──────┐  │
│  Supabase   │  ├── Asaas (pagamentos)
│ PostgreSQL  │  ├── Evolution API (WhatsApp)
└─────────────┘  ├── Google APIs (OAuth + Calendar)
                 ├── Resend (e-mails transacionais)
                 └── Google Gemini (IA)
```

---

## 1. Frontend

| Item | Detalhe |
|------|---------|
| **Linguagem** | TypeScript 5.8 |
| **Framework** | React 19 |
| **Build tool** | Vite 6 |
| **Roteamento** | React Router DOM 6.22 (BrowserRouter) |
| **Estilo** | Tailwind CSS + CSS-in-JS inline (style props) |
| **Animações** | Framer Motion 12 |
| **Ícones** | Lucide React |
| **Gráficos** | Recharts 2.12 |
| **Vídeo/Animação** | Remotion 4 + @remotion/player (demo interativa) |
| **IA no cliente** | Google Generative AI (@google/genai) |
| **Estado global** | React Context API (AppContext) |
| **HTTP Client** | Fetch nativo via `/services/api.ts` |

### Estrutura de Pastas (Frontend)
```
/
├── pages/          # Páginas completas (LandingPage, Dashboard, etc.)
├── components/     # Componentes reutilizáveis
├── context/        # AppContext — estado global
├── services/       # api.ts (HTTP client) + geminiService.ts
├── types.ts        # Tipos TypeScript globais
├── constants.ts    # PLAN_PERMISSIONS e constantes
└── index.tsx       # Entry point → App.tsx (rotas)
```

### Roles de usuário
```typescript
enum UserRole {
  OWNER        // Dono da plataforma SaaS
  ADMIN        // Administrador da clínica
  RECEPTIONIST // Acesso a agenda e pacientes
  ESTHETICIAN  // Profissional/esteticista
  PATIENT      // Portal do paciente
}
```

---

## 2. Backend

| Item | Detalhe |
|------|---------|
| **Linguagem** | TypeScript 5.7 |
| **Framework** | Next.js 15 (App Router) |
| **Porta dev** | 3001 |
| **ORM** | Prisma 6 |
| **Banco de dados** | PostgreSQL (via Supabase) |
| **Autenticação** | JWT (jsonwebtoken 9) + bcryptjs |
| **Validação** | Zod 3 |
| **Rate limiting** | @upstash/ratelimit + @upstash/redis |
| **E-mails** | Resend |
| **Criptografia** | AES-256-GCM (tokens OAuth) + SHA-256 (LGPD) |

### Estrutura de API (`/aura-backend/src/app/api/`)
```
auth/           # Login, registro, Google OAuth, reset de senha
appointments/   # CRUD de agendamentos + status + WhatsApp
patients/       # Gestão de pacientes/clientes
transactions/   # Lançamentos financeiros
procedures/     # Procedimentos e serviços da clínica
users/          # Gestão de profissionais
companies/      # Multi-tenancy — dados da clínica
billing/        # Checkout, planos, assinaturas (Asaas)
webhooks/asaas/ # Recebimento de eventos de pagamento
whatsapp/       # Configuração de instâncias (Evolution API)
cron/           # Jobs automáticos (Vercel Cron)
ai/             # Endpoints de IA (Gemini)
reports/        # Relatórios e analytics
retention/      # Módulo de retenção de clientes
subscriptions/  # Planos de assinatura internos (Clube)
dashboard/      # Métricas consolidadas
king/           # Painel owner/SaaS admin
inventory/      # Estoque de produtos
leads/          # Captação de leads
notifications/  # Notificações internas
tasks/          # Tarefas e checklist
tickets/        # Suporte
photos/         # Upload de fotos de procedimentos
public/         # Endpoints públicos (agendamento online)
health/         # Health check
```

### Libs internas (`/aura-backend/src/lib/`)
| Arquivo | Função |
|---------|--------|
| `auth.ts` | Geração/validação de JWT |
| `rbac.ts` | Role-based access control |
| `apiGuards.ts` | Middleware de proteção de rotas |
| `planPermissions.ts` | Controle por plano SaaS |
| `asaas.ts` | Cliente REST Asaas |
| `whatsapp.ts` | Cliente Evolution API |
| `whatsappMessages.ts` | Templates de mensagens |
| `email.ts` | Cliente Resend |
| `google.ts` | Google OAuth + Calendar |
| `calendarSync.ts` | Sincronização bidirecional |
| `rateLimiter.ts` | Rate limit com Upstash Redis |
| `crypto.ts` | Criptografia AES-256-GCM |
| `auditLog.ts` | Log de auditoria (LGPD) |
| `prisma.ts` | Singleton do Prisma Client |
| `businessHours.ts` | Lógica de horários de funcionamento |

---

## 3. Banco de Dados

| Item | Detalhe |
|------|---------|
| **Provider** | Supabase (PostgreSQL gerenciado) |
| **ORM** | Prisma 6 com Prisma Client |
| **Conexão prod** | PgBouncer pooler (DATABASE_URL) |
| **Conexão migrate** | Conexão direta (DIRECT_URL) |
| **Modelos principais** | User, Company, Appointment, Patient, Transaction, Procedure, SaasSubscription, SubscriptionPlan |

### Multi-tenancy
Todos os dados são escopados por `companyId`. Cada clínica é uma `Company` isolada. Profissionais, pacientes e transações pertencem a uma company.

---

## 4. Serviços Externos

### Asaas (Pagamentos)
- **O que faz:** Cobranças recorrentes dos planos SaaS, PIX, boleto
- **Ambiente:** Sandbox (`sandbox.asaas.com`) e produção (`api.asaas.com`)
- **Integração:** REST API + Webhooks (eventos de pagamento em `/api/webhooks/asaas`)
- **Variáveis:** `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_SANDBOX`

### Evolution API (WhatsApp)
- **O que faz:** Envio de confirmações de agendamento, lembretes e mensagens de retorno para pacientes
- **Modelo:** Self-hosted (instância por clínica)
- **Integração:** REST API + instâncias dinâmicas por `companyId`
- **Variáveis:** `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`

### Google APIs
- **OAuth 2.0:** Login social + autorização de Calendar
- **Google Calendar:** Sincronização bidirecional de agendamentos (webhook via watch)
- **Scopes:** `calendar.events`, `calendar.readonly`, `userinfo.email`, `userinfo.profile`
- **Variáveis:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

### Resend (E-mails)
- **O que faz:** E-mails transacionais — verificação de conta, reset de senha, confirmações
- **Variável:** `RESEND_API_KEY`

### Google Gemini (IA)
- **O que faz:** Sugestões de mensagens de retorno para clientes inativos, análise de dados
- **Modelo:** Gemini via `@google/genai`
- **Variável:** `GEMINI_API_KEY`

### Upstash Redis (Rate Limiting)
- **O que faz:** Rate limiting distribuído nas APIs (protege contra abuso)
- **Variáveis:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

---

## 5. Deploy e Infraestrutura

### Vercel
| App | Projeto Vercel | Comando de deploy |
|-----|---------------|-------------------|
| Frontend | `aura-system` | `vercel --prod --yes` (na raiz `/`) |
| Backend | `aura-backend-api` | `vercel --prod --yes` (em `/aura-backend`) |

> **Importante:** GitHub auto-deploy está desativado. Todo deploy é feito manualmente via Vercel CLI.

### URLs de produção
| Ambiente | URL |
|----------|-----|
| Frontend | `https://aura-system-mu.vercel.app` |
| Backend | `https://aura-backend-api.vercel.app` |

### Vercel Cron Jobs (Backend)
| Job | Schedule | Função |
|-----|----------|--------|
| `check-subscriptions` | Todo dia às 06h | Verifica expiração de planos |
| `renew-calendar-watches` | A cada 6 dias às 06h | Renova webhooks do Google Calendar |
| `whatsapp-reminders` | Todo dia às 11h | Envia lembretes de agendamento |
| `process-deletions` | Todo dia às 03h | Processa solicitações de exclusão (LGPD) |
| `data-retention` | Todo dia às 04h | Política de retenção de dados (LGPD) |

### Headers de segurança (Frontend)
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

### SPA Rewrite (Frontend)
```json
{ "source": "/(.*)", "destination": "/" }
```
Necessário para o BrowserRouter funcionar corretamente no Vercel.

---

## 6. Testes

| Tipo | Framework | Comando |
|------|-----------|---------|
| Unitários / Integração | Vitest 4 | `cd aura-backend && npm run test:ci` |
| E2E | Playwright | `npx playwright test` |
| Cobertura | @vitest/coverage-v8 | `npm run test:coverage` |
| Tudo junto | Script bash | `bash test-all.sh` |

- **651+ testes unitários** no backend (Vitest)
- **24 testes E2E** apontados para produção (`aura-system-mu.vercel.app`)
- Testes E2E rodam em Chromium, Firefox e WebKit (via Playwright)

---

## 7. Controle de Versão

| Item | Detalhe |
|------|---------|
| **VCS** | Git |
| **Repositório** | GitHub (privado) |
| **Branch principal** | `master` |
| **Estratégia** | Commits diretos na master (sem PRs formais) |

---

## 8. Segurança e LGPD

- **JWT** com `tokenVersion` — invalida todos os tokens após troca de senha
- **bcrypt** para hash de senhas
- **AES-256-GCM** para criptografar tokens OAuth armazenados no banco
- **Rate limiting** por IP via Upstash Redis
- **Audit log** de ações sensíveis
- **LGPD:** Consentimento de marketing separado, aceite de termos com IP + user-agent + hash do texto, cron de data retention, cron de process-deletions
- **RBAC** — cada role tem permissões específicas verificadas em cada endpoint

---

## 9. Variáveis de Ambiente (Resumo)

### Backend (aura-backend/.env)
```
DATABASE_URL          # Supabase pooler
DIRECT_URL            # Supabase direto (migrações)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
SESSION_SECRET
ENCRYPTION_KEY        # AES-256-GCM (64 hex chars)
FRONTEND_URL
CRON_SECRET
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
GEMINI_API_KEY
ASAAS_API_KEY
ASAAS_BASE_URL
ASAAS_SANDBOX
EVOLUTION_API_URL
EVOLUTION_API_KEY
RESEND_API_KEY
NODE_ENV
```

### Frontend (.env.local)
```
VITE_API_URL          # URL do backend (http://localhost:3001 em dev)
GEMINI_API_KEY        # Para features de IA no cliente
```

---

## 10. Comandos do Dia a Dia

```bash
# Desenvolvimento local
.\start-all.bat                     # Inicia frontend (3000) + backend (3001)
npm run dev                         # Só frontend
cd aura-backend && npm run dev      # Só backend

# Banco de dados
cd aura-backend
npm run db:generate   # Gera Prisma Client após mudanças no schema
npm run db:push       # Aplica schema no banco
npm run db:studio     # GUI do banco (Prisma Studio)
npm run db:seed       # Popula dados iniciais

# Deploy
vercel --prod --yes                             # Deploy frontend
cd aura-backend && vercel --prod --yes          # Deploy backend

# Testes
cd aura-backend && npm run test:ci              # Unitários
npx playwright test                             # E2E
bash test-all.sh                                # Tudo

# Lint
cd aura-backend && npm run lint
```
