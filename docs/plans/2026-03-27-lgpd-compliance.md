# LGPD & Marco Civil Compliance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar os 5 itens de conformidade jurídica (LGPD + Marco Civil) que estão faltando no Aura System.

**Architecture:** Todas as mudanças são no backend (Next.js 15 App Router + Prisma). O log de acesso usa o model `Activity` já existente. Deleção de conta segue soft-delete por 30 dias (obrigação fiscal) antes de anonimização. Consentimento de marketing é um campo separado no User.

**Tech Stack:** Next.js 15 App Router, Prisma ORM, PostgreSQL (Supabase), Vitest para testes, React + TypeScript no frontend

---

## Contexto do projeto

- Backend: `aura-backend/` — rotas em `src/app/api/*/route.ts`
- Testes: `aura-backend/src/__tests__/api/` e `__tests__/lib/`
- Schema: `aura-backend/prisma/schema.prisma`
- Model `Activity` já existe com `ipAddress`, `userAgent`, `userId`, `type`, `metadata`
- `logLogin()` já chama `logActivity()` com type `USER_LOGIN` — **falta** reter por 6 meses e expor via API
- Commit format: `aura_system_X.Y — type(scope): descrição`

---

## Task 1: Log de acesso (Marco Civil art. 13) — retenção de 6 meses e API de consulta

**Objetivo:** Garantir que logins ficam retidos por 6 meses e que o OWNER pode consultá-los.

**Files:**
- Modify: `aura-backend/prisma/schema.prisma` — adicionar campo `retainUntil` no Activity
- Create: `aura-backend/src/app/api/king/access-logs/route.ts`
- Create: `aura-backend/src/__tests__/api/access-logs.test.ts`

**Step 1: Escrever o teste falhando**

Arquivo: `aura-backend/src/__tests__/api/access-logs.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    activity: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/king/access-logs/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const OWNER = { id: 'u1', role: 'OWNER', companyId: null, email: 'king@aura.system', name: 'King' }
const ADMIN = { id: 'u2', role: 'ADMIN', companyId: 'c1', email: 'a@b.com', name: 'Admin' }

function makeReq() {
  return new NextRequest('http://localhost/api/king/access-logs')
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/king/access-logs', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('retorna 403 para não-OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeReq())
    expect(res.status).toBe(403)
  })

  it('retorna logs de USER_LOGIN para OWNER', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as never)
    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      { id: '1', type: 'USER_LOGIN', title: 'Login: a@b.com', ipAddress: '1.2.3.4', userAgent: 'Chrome', createdAt: new Date(), metadata: { email: 'a@b.com' }, userId: 'u2', description: null } as never,
    ])
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].ipAddress).toBe('1.2.3.4')
  })
})
```

**Step 2: Rodar para confirmar que falha**

```bash
cd aura-backend && npm run test:ci -- --reporter=verbose 2>&1 | grep "access-logs"
```
Esperado: FAIL — `Cannot find module`

**Step 3: Adicionar campo `retainUntil` no schema**

Em `aura-backend/prisma/schema.prisma`, no model `Activity`, adicionar após `userAgent`:
```prisma
retainUntil  DateTime?  // Marco Civil: manter por 6 meses; null = sem expiração
```

**Step 4: Push do schema**
```bash
cd aura-backend && npm run db:push
```

**Step 5: Atualizar `logLogin()` para gravar `retainUntil`**

Em `aura-backend/src/lib/auditLog.ts`, na função `logActivity`, adicionar campo ao `prisma.activity.create`:
```typescript
retainUntil: params.retainUntil ?? null,
```

E adicionar ao interface `AuditLogParams`:
```typescript
retainUntil?: Date;
```

Na função `logLogin()`, passar `retainUntil`:
```typescript
const retainUntil = new Date();
retainUntil.setMonth(retainUntil.getMonth() + 6);
await logActivity({
  // ...campos existentes...
  retainUntil,
});
```

**Step 6: Criar a rota `GET /api/king/access-logs`**

Arquivo: `aura-backend/src/app/api/king/access-logs/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
  if (user.role !== "OWNER") return NextResponse.json({ error: "Acesso restrito" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"))

  const logs = await prisma.activity.findMany({
    where: { type: "USER_LOGIN" },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      title: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      retainUntil: true,
      metadata: true,
      userId: true,
    },
  })

  return NextResponse.json({ data: logs, page, limit })
}
```

**Step 7: Rodar testes e confirmar que passam**
```bash
cd aura-backend && npm run test:ci 2>&1 | tail -5
```
Esperado: todos os testes passando

**Step 8: Commit**
```bash
git add aura-backend/prisma/schema.prisma aura-backend/src/lib/auditLog.ts aura-backend/src/app/api/king/access-logs/route.ts aura-backend/src/__tests__/api/access-logs.test.ts
git commit -m "aura_system_2.1 — feat(compliance): log de acesso com retenção de 6 meses (Marco Civil art. 13)"
```

---

## Task 2: Direito de exclusão de dados (LGPD art. 18)

**Objetivo:** Usuário/admin pode solicitar exclusão da conta. Dados ficam em soft-delete por 30 dias (obrigação fiscal) e então são anonimizados. OWNER pode ver e processar pedidos.

**Files:**
- Modify: `aura-backend/prisma/schema.prisma` — model `DeletionRequest`
- Create: `aura-backend/src/app/api/account/deletion-request/route.ts`
- Create: `aura-backend/src/app/api/king/deletion-requests/route.ts`
- Create: `aura-backend/src/__tests__/api/deletion-request.test.ts`

**Step 1: Escrever o teste falhando**

Arquivo: `aura-backend/src/__tests__/api/deletion-request.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    deletionRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: { update: vi.fn(), findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { POST, GET } from '../../app/api/account/deletion-request/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', role: 'ADMIN', companyId: 'c1', email: 'a@b.com', name: 'Admin' }

function makePostReq(body = {}) {
  return new NextRequest('http://localhost/api/account/deletion-request', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/account/deletion-request', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostReq())
    expect(res.status).toBe(401)
  })

  it('cria pedido de exclusão com data de anonimização em 30 dias', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.deletionRequest.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.deletionRequest.create).mockResolvedValue({
      id: 'dr1', userId: 'u1', status: 'PENDING', scheduledFor: new Date(),
    } as never)
    const res = await POST(makePostReq({ reason: 'Não quero mais usar' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.status).toBe('PENDING')
  })

  it('não cria pedido duplicado se já existe PENDING', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.deletionRequest.findFirst).mockResolvedValue({ id: 'dr1' } as never)
    const res = await POST(makePostReq())
    expect(res.status).toBe(409)
  })
})

describe('GET /api/account/deletion-request', () => {
  it('retorna pedido existente do usuário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.deletionRequest.findFirst).mockResolvedValue({
      id: 'dr1', status: 'PENDING', scheduledFor: new Date(), reason: 'test',
    } as never)
    const res = await GET(new NextRequest('http://localhost/api/account/deletion-request'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('PENDING')
  })
})
```

**Step 2: Rodar para confirmar que falha**
```bash
cd aura-backend && npm run test:ci 2>&1 | grep "deletion-request"
```

**Step 3: Adicionar model `DeletionRequest` no schema**

Em `aura-backend/prisma/schema.prisma`, antes do último `}` do arquivo, adicionar:

```prisma
enum DeletionRequestStatus {
  PENDING    // Aguardando processamento (30 dias)
  PROCESSED  // Dados anonimizados
  CANCELED   // Cancelado pelo usuário
}

model DeletionRequest {
  id            String                  @id @default(cuid())
  userId        String
  user          User                    @relation(fields: [userId], references: [id])
  status        DeletionRequestStatus   @default(PENDING)
  reason        String?
  scheduledFor  DateTime                // Data em que a anonimização ocorrerá (now + 30 dias)
  processedAt   DateTime?
  createdAt     DateTime                @default(now())
  updatedAt     DateTime                @updatedAt

  @@index([userId])
  @@index([status, scheduledFor])
  @@map("deletion_requests")
}
```

Também adicionar relação no model `User`:
```prisma
deletionRequests  DeletionRequest[]
```

**Step 4: Push do schema**
```bash
cd aura-backend && npm run db:push
```

**Step 5: Criar rota `POST|GET /api/account/deletion-request`**

Arquivo: `aura-backend/src/app/api/account/deletion-request/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const req = await prisma.deletionRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
    select: { id: true, status: true, scheduledFor: true, reason: true, createdAt: true },
  })

  return NextResponse.json({ data: req ?? null })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const existing = await prisma.deletionRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
  })
  if (existing) {
    return NextResponse.json(
      { error: "Já existe um pedido de exclusão pendente", code: "ALREADY_PENDING" },
      { status: 409 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const scheduledFor = new Date()
  scheduledFor.setDate(scheduledFor.getDate() + 30)

  const req = await prisma.deletionRequest.create({
    data: {
      userId: user.id,
      reason: body.reason ?? null,
      scheduledFor,
    },
    select: { id: true, status: true, scheduledFor: true, reason: true },
  })

  return NextResponse.json({ data: req }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  await prisma.deletionRequest.updateMany({
    where: { userId: user.id, status: "PENDING" },
    data: { status: "CANCELED" },
  })

  return NextResponse.json({ success: true })
}
```

**Step 6: Criar cron de anonimização `GET /api/cron/process-deletions`**

Arquivo: `aura-backend/src/app/api/cron/process-deletions/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const due = await prisma.deletionRequest.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    select: { id: true, userId: true },
  })

  let processed = 0
  for (const req of due) {
    // Anonimizar usuário — LGPD art. 16: manter dados necessários para obrigação legal
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        name: "Usuário Removido",
        email: `deleted_${req.userId}@aura.removed`,
        password: "",
        isActive: false,
        emailVerified: null,
        verificationToken: null,
        resetPasswordToken: null,
      },
    })
    await prisma.deletionRequest.update({
      where: { id: req.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    })
    processed++
  }

  return NextResponse.json({ processed, total: due.length })
}
```

Adicionar o cron em `aura-backend/vercel.json`:
```json
{ "path": "/api/cron/process-deletions", "schedule": "0 3 * * *" }
```

**Step 7: Rodar testes**
```bash
cd aura-backend && npm run test:ci 2>&1 | tail -5
```

**Step 8: Commit**
```bash
git add aura-backend/prisma/schema.prisma \
  aura-backend/src/app/api/account/deletion-request/route.ts \
  aura-backend/src/app/api/cron/process-deletions/route.ts \
  aura-backend/src/__tests__/api/deletion-request.test.ts
git commit -m "aura_system_2.2 — feat(compliance): direito de exclusão de dados LGPD art. 18"
```

---

## Task 3: Consentimento granular de marketing

**Objetivo:** Checkbox separado no cadastro para opt-in de emails de marketing. Independente dos Termos de Uso.

**Files:**
- Modify: `aura-backend/prisma/schema.prisma` — campos `marketingConsent*` no User
- Modify: `aura-backend/src/app/api/auth/register/route.ts`
- Create: `aura-backend/src/app/api/account/marketing-consent/route.ts`
- Modify: `pages/Login.tsx` — adicionar checkbox de marketing no cadastro
- Create: `aura-backend/src/__tests__/api/marketing-consent.test.ts`

**Step 1: Escrever o teste falhando**

Arquivo: `aura-backend/src/__tests__/api/marketing-consent.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { user: { update: vi.fn(), findUnique: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { PUT, GET } from '../../app/api/account/marketing-consent/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const USER = { id: 'u1', role: 'ADMIN', companyId: 'c1', email: 'a@b.com', name: 'Admin' }

beforeEach(() => vi.clearAllMocks())

describe('PUT /api/account/marketing-consent', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await PUT(new NextRequest('http://localhost/api/account/marketing-consent', {
      method: 'PUT', body: JSON.stringify({ consent: true }), headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(401)
  })

  it('atualiza consentimento de marketing com IP e timestamp', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(USER as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)
    const res = await PUT(new NextRequest('http://localhost/api/account/marketing-consent', {
      method: 'PUT',
      body: JSON.stringify({ consent: true }),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    }))
    expect(res.status).toBe(200)
    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
    expect(updateCall.data.marketingConsent).toBe(true)
    expect(updateCall.data.marketingConsentIp).toBe('1.2.3.4')
  })
})
```

**Step 2: Rodar para confirmar que falha**
```bash
cd aura-backend && npm run test:ci 2>&1 | grep "marketing-consent"
```

**Step 3: Adicionar campos de marketing consent no schema**

No model `User`, após os campos `acceptedTerms*`:
```prisma
// Consentimento de marketing (opt-in separado — LGPD)
marketingConsent    Boolean   @default(false)
marketingConsentAt  DateTime?
marketingConsentIp  String?
```

**Step 4: Push do schema**
```bash
cd aura-backend && npm run db:push
```

**Step 5: Criar rota `PUT|GET /api/account/marketing-consent`**

Arquivo: `aura-backend/src/app/api/account/marketing-consent/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const data = await prisma.user.findUnique({
    where: { id: user.id },
    select: { marketingConsent: true, marketingConsentAt: true },
  })
  return NextResponse.json({ data })
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const consent = Boolean(body.consent)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip") ?? "unknown"

  await prisma.user.update({
    where: { id: user.id },
    data: {
      marketingConsent: consent,
      marketingConsentAt: new Date(),
      marketingConsentIp: ip,
    },
  })

  return NextResponse.json({ success: true, consent })
}
```

**Step 6: Atualizar register para salvar consentimento de marketing**

Em `aura-backend/src/app/api/auth/register/route.ts`:

No schema zod, adicionar:
```typescript
marketingConsent: z.boolean().optional(),
```

Na desestruturação:
```typescript
const { name, email, password, companyName, state, acceptedTerms, marketingConsent } = validation.data;
```

No `prisma.user.create`, adicionar:
```typescript
marketingConsent: marketingConsent ?? false,
marketingConsentAt: marketingConsent ? new Date() : null,
marketingConsentIp: marketingConsent ? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown") : null,
```

**Step 7: Adicionar checkbox de marketing no frontend**

Em `pages/Login.tsx`, após o checkbox de termos de uso (após a tag `</label>` do acceptedTerms), adicionar novo checkbox:

```tsx
{/* Marketing opt-in — separado dos Termos (LGPD) */}
<label className="flex items-start gap-3 cursor-pointer group">
  <div className="relative mt-0.5 shrink-0">
    <input
      type="checkbox"
      className="sr-only"
      checked={regData.marketingConsent ?? false}
      onChange={e => setRegData({ ...regData, marketingConsent: e.target.checked })}
    />
    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${regData.marketingConsent ? 'bg-primary-500 border-primary-500' : 'border-secondary-300 group-hover:border-primary-400'}`}>
      {regData.marketingConsent && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  </div>
  <span className="text-xs text-secondary-600 leading-relaxed">
    Quero receber novidades, dicas e atualizações do Aura System por email. <span className="text-secondary-400">(opcional)</span>
  </span>
</label>
```

Também adicionar `marketingConsent` ao estado `regData` e ao payload enviado para a API.

**Step 8: Rodar testes**
```bash
cd aura-backend && npm run test:ci 2>&1 | tail -5
```

**Step 9: Commit**
```bash
git add aura-backend/prisma/schema.prisma \
  aura-backend/src/app/api/auth/register/route.ts \
  aura-backend/src/app/api/account/marketing-consent/route.ts \
  aura-backend/src/__tests__/api/marketing-consent.test.ts \
  pages/Login.tsx
git commit -m "aura_system_2.3 — feat(compliance): consentimento granular de marketing (LGPD opt-in separado)"
```

---

## Task 4: Política de Privacidade linkada explicitamente no cadastro

**Objetivo:** Garantir que o link para Política de Privacidade está visível e funcional no formulário de cadastro (já existe no Login.tsx mas precisa verificar se a rota está correta no App.tsx).

**Files:**
- Modify: `App.tsx` — verificar/adicionar rotas `/politica-de-privacidade` e `/termos-de-uso`
- Verify: `pages/PrivacyPolicy.tsx` e `pages/TermsOfUse.tsx` existem e têm conteúdo adequado

**Step 1: Verificar rotas no App.tsx**

```bash
grep -n "politica\|termos\|PrivacyPolicy\|TermsOfUse" /c/Aura_System/App.tsx
```

Se as rotas não existirem, adicionar em `App.tsx`:
```tsx
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfUse from './pages/TermsOfUse'
// Nas rotas:
<Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
<Route path="/termos-de-uso" element={<TermsOfUse />} />
```

**Step 2: Verificar que as páginas têm data de vigência e versão**

`pages/PrivacyPolicy.tsx` deve mencionar:
- Data de última atualização
- Versão do documento
- Como exercer direitos LGPD (art. 18) — incluindo link para solicitar exclusão

`pages/TermsOfUse.tsx` deve mencionar:
- Data de última atualização
- Versão `1.0` (igual ao `TERMS_VERSION`)

**Step 3: Commit** (somente se houve mudanças)
```bash
git add App.tsx pages/PrivacyPolicy.tsx pages/TermsOfUse.tsx
git commit -m "aura_system_2.4 — fix(compliance): rotas e conteúdo de Política de Privacidade e Termos de Uso"
```

---

## Task 5: Política de retenção de dados pós-cancelamento

**Objetivo:** Implementar cron que anonimiza dados de empresas canceladas após 90 dias (prazo fiscal mínimo). Documentar a política.

**Files:**
- Create: `aura-backend/src/app/api/cron/data-retention/route.ts`
- Modify: `aura-backend/vercel.json` — adicionar cron schedule
- Create: `aura-backend/src/__tests__/api/data-retention.test.ts`

**Step 1: Escrever o teste falhando**

Arquivo: `aura-backend/src/__tests__/api/data-retention.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: { findMany: vi.fn(), update: vi.fn() },
    user: { updateMany: vi.fn() },
    patient: { updateMany: vi.fn() },
  },
}))

import { GET } from '../../app/api/cron/data-retention/route'
import prisma from '@/lib/prisma'

function makeReq() {
  return new NextRequest('http://localhost/api/cron/data-retention', {
    headers: { authorization: 'Bearer test-secret' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
})

describe('GET /api/cron/data-retention', () => {
  it('retorna 401 sem CRON_SECRET correto', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/data-retention', {
      headers: { authorization: 'Bearer wrong' },
    }))
    expect(res.status).toBe(401)
  })

  it('processa empresas canceladas há mais de 90 dias', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'c1', name: 'Clínica X', subscriptionStatus: 'CANCELED' } as never,
    ])
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 2 })
    vi.mocked(prisma.patient.updateMany).mockResolvedValue({ count: 5 })
    vi.mocked(prisma.company.update).mockResolvedValue({} as never)

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(1)
  })

  it('retorna 0 processados quando não há empresas elegíveis', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([])
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
  })
})
```

**Step 2: Rodar para confirmar que falha**
```bash
cd aura-backend && npm run test:ci 2>&1 | grep "data-retention"
```

**Step 3: Criar a rota do cron**

Arquivo: `aura-backend/src/app/api/cron/data-retention/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// Política de retenção: 90 dias após cancelamento (mínimo fiscal brasileiro)
const RETENTION_DAYS = 90

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "")
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

  // Empresas canceladas há mais de 90 dias
  const companies = await prisma.company.findMany({
    where: {
      subscriptionStatus: "CANCELED",
      subscriptionExpiresAt: { lte: cutoff },
    },
    select: { id: true, name: true },
  })

  let processed = 0
  for (const company of companies) {
    // Anonimizar dados pessoais de pacientes
    await prisma.patient.updateMany({
      where: { companyId: company.id },
      data: {
        name: "Paciente Removido",
        email: null,
        phone: null,
        cpf: null,
        birthDate: null,
        address: null,
      },
    })

    // Desativar usuários
    await prisma.user.updateMany({
      where: { companyId: company.id },
      data: { isActive: false },
    })

    // Marcar empresa como processada (usar nome anonimizado)
    await prisma.company.update({
      where: { id: company.id },
      data: { name: `Empresa Removida (${company.id.slice(-6)})` },
    })

    processed++
    console.log(`[Retention] Empresa ${company.id} anonimizada`)
  }

  return NextResponse.json({ processed, total: companies.length })
}
```

**Step 4: Adicionar cron ao `vercel.json`**

Em `aura-backend/vercel.json`, adicionar na array `crons`:
```json
{ "path": "/api/cron/data-retention", "schedule": "0 4 * * *" }
```

**Step 5: Rodar testes**
```bash
cd aura-backend && npm run test:ci 2>&1 | tail -5
```

**Step 6: Commit**
```bash
git add aura-backend/src/app/api/cron/data-retention/route.ts \
  aura-backend/src/__tests__/api/data-retention.test.ts \
  aura-backend/vercel.json
git commit -m "aura_system_2.5 — feat(compliance): política de retenção de dados 90 dias pós-cancelamento"
```

---

## Checklist Final

Após todos os tasks:

- [ ] `npm run test:ci` — todos os testes passando
- [ ] `vercel --prod --yes` no backend
- [ ] `vercel --prod --yes` no frontend (para o checkbox de marketing)
- [ ] Verificar no Prisma Studio que os campos novos existem no banco
- [ ] Testar cadastro com checkbox de marketing marcado e desmarcado
- [ ] Verificar `GET /api/king/access-logs` retorna logins

**Commit versão final:**
```bash
git log --oneline -8
```
