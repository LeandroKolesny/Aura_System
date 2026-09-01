# TDD Security & Coverage Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar testes para todas as 15 vulnerabilidades corrigidas e cobrir as lacunas críticas de lib/apiGuards e fluxos de auth.

**Architecture:** Vitest + vi.mock(). Todos os mocks ANTES dos imports. Pattern: `as unknown as Type` em vez de `as any`. Cada arquivo de teste é independente e pode ser executado isoladamente.

**Tech Stack:** Vitest 4.x, NextRequest/NextResponse do Next.js 15, Prisma Client types, bcryptjs, jsonwebtoken

**Estado atual:** 563 testes passando em 11 arquivos. Nenhum `any` nos arquivos de teste.

---

## Task 0: Exportar `isOriginAllowed` do middleware para testabilidade

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Adicionar export**

```typescript
// Em src/middleware.ts, linha 12 — trocar:
function isOriginAllowed(origin: string | null): boolean {
// Por:
export function isOriginAllowed(origin: string | null): boolean {
```

**Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```
Expected: sem erros

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "refactor(middleware): export isOriginAllowed for unit testability"
```

---

## Task 1: Testes de segurança — Middleware CORS/CSRF

**Files:**
- Create: `src/__tests__/security/middleware.test.ts`

**Step 1: Criar o arquivo de teste**

```typescript
// src/__tests__/security/middleware.test.ts
// Testes de segurança para CORS/CSRF no middleware

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: vi.fn().mockImplementation((req: NextRequest) =>
    Promise.resolve(new Response(null, { status: 200 }))
  ),
}))

import { middleware, isOriginAllowed } from '../../middleware'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(method: string, origin: string | null, path = '/api/test') {
  const headers: Record<string, string> = {}
  if (origin !== null) headers['origin'] = origin
  return new NextRequest(`http://localhost${path}`, { method, headers })
}

// ---------------------------------------------------------------------------
// isOriginAllowed — função pura testada em isolamento
// ---------------------------------------------------------------------------
describe('isOriginAllowed', () => {
  it('retorna false para origin null', () => {
    expect(isOriginAllowed(null)).toBe(false)
  })

  it('retorna false para string vazia', () => {
    expect(isOriginAllowed('')).toBe(false)
  })

  it('permite http://localhost:3000', () => {
    expect(isOriginAllowed('http://localhost:3000')).toBe(true)
  })

  it('permite http://localhost:5173', () => {
    expect(isOriginAllowed('http://localhost:5173')).toBe(true)
  })

  it('permite https://aura-system-mu.vercel.app', () => {
    expect(isOriginAllowed('https://aura-system-mu.vercel.app')).toBe(true)
  })

  it('permite IP local 192.168.x.x:3000 (regex)', () => {
    expect(isOriginAllowed('http://192.168.1.100:3000')).toBe(true)
    expect(isOriginAllowed('http://192.168.0.1:3000')).toBe(true)
  })

  it('bloqueia domínio desconhecido', () => {
    expect(isOriginAllowed('https://evil.com')).toBe(false)
  })

  it('bloqueia porta incorreta em localhost', () => {
    expect(isOriginAllowed('http://localhost:4000')).toBe(false)
  })

  it('bloqueia domínio similar ao permitido (subdomain attack)', () => {
    expect(isOriginAllowed('https://evil-aura-system-mu.vercel.app')).toBe(false)
    expect(isOriginAllowed('https://aura-system-mu.vercel.app.evil.com')).toBe(false)
  })

  it('bloqueia IP fora da faixa 192.168.x.x', () => {
    expect(isOriginAllowed('http://10.0.0.1:3000')).toBe(false)
    expect(isOriginAllowed('http://172.16.0.1:3000')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// middleware — proteção CSRF (null-origin bypass VULN-01)
// ---------------------------------------------------------------------------
describe('middleware CSRF protection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('SECURITY: bloqueia POST sem Origin (null-origin bypass)', async () => {
    const req = makeRequest('POST', null)
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('SECURITY: bloqueia PUT sem Origin', async () => {
    const req = makeRequest('PUT', null)
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('SECURITY: bloqueia POST de origem desconhecida', async () => {
    const req = makeRequest('POST', 'https://evil.com')
    const res = await middleware(req)
    expect(res.status).toBe(403)
  })

  it('permite POST de localhost:3000', async () => {
    const req = makeRequest('POST', 'http://localhost:3000')
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
  })

  it('permite GET sem Origin (requests server-to-server)', async () => {
    const req = makeRequest('GET', null)
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
  })

  it('permite POST para /api/webhooks/ sem Origin (webhook externo)', async () => {
    const req = makeRequest('POST', null, '/api/webhooks/asaas')
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
  })

  it('responde OPTIONS (preflight) com 200', async () => {
    const req = makeRequest('OPTIONS', 'http://localhost:3000')
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })

  it('inclui Access-Control-Allow-Origin na resposta quando origin é permitida', async () => {
    const req = makeRequest('GET', 'http://localhost:3000')
    const res = await middleware(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
  })

  it('não inclui Access-Control-Allow-Origin quando origin é desconhecida', async () => {
    const req = makeRequest('GET', 'https://evil.com')
    const res = await middleware(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
```

**Step 2: Rodar e confirmar passa**

```bash
npx vitest run src/__tests__/security/middleware.test.ts
```
Expected: all tests PASS

**Step 3: Commit**

```bash
git add src/__tests__/security/middleware.test.ts
git commit -m "test(security): CORS/CSRF middleware protection tests (VULN-01)"
```

---

## Task 2: Testes de segurança — Login

**Files:**
- Create: `src/__tests__/security/login-security.test.ts`

**Step 1: Criar o arquivo**

```typescript
// src/__tests__/security/login-security.test.ts
// Testes de segurança para o endpoint POST /api/auth/login

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import type { User } from '@prisma/client'

// Mocks ANTES dos imports do módulo
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn() },
    systemSettings: { findUnique: vi.fn() },
  },
}))
vi.mock('@/lib/rateLimiter', () => ({
  checkRateLimit: vi.fn(),
  resetRateLimit: vi.fn().mockResolvedValue(undefined),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))
vi.mock('@/lib/auditLog', () => ({
  logLogin: vi.fn(),
  logLoginFailure: vi.fn(),
}))
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}))

import { POST } from '../../app/api/auth/login/route'
import prisma from '@/lib/prisma'
import { checkRateLimit, resetRateLimit } from '@/lib/rateLimiter'
import { logLogin, logLoginFailure } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const MOCK_USER = {
  id: 'user-001',
  email: 'admin@clinic.com',
  name: 'Admin',
  password: '$2b$12$hashedpasswordvalue.here',
  avatar: null,
  role: 'ADMIN',
  isActive: true,
  tokenVersion: 0,
  emailVerified: new Date('2026-01-01'),
  company: {
    id: 'company-001',
    name: 'Clínica Teste',
    slug: 'clinica-teste',
    plan: 'STARTER',
    subscriptionStatus: 'ACTIVE',
    subscriptionExpiresAt: new Date('2027-01-01'),
    businessHours: {},
    onboardingCompleted: true,
  },
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true })
  vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue(null)
})

// ---------------------------------------------------------------------------
// Timing attack prevention (VULN-10)
// ---------------------------------------------------------------------------
describe('SECURITY: timing attack prevention', () => {
  it('chama bcrypt.compare mesmo quando usuário não existe', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

    await POST(makeRequest({ email: 'notexist@test.com', password: 'any-password' }))

    expect(bcrypt.compare).toHaveBeenCalledOnce()
    const [, hashArg] = vi.mocked(bcrypt.compare).mock.calls[0] as [string, string]
    // Hash dummy deve ser um bcrypt hash válido (não null/undefined)
    expect(hashArg).toMatch(/^\$2b\$/)
  })

  it('retorna mesma mensagem de erro para usuário inexistente e senha incorreta', async () => {
    // Usuário não existe
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
    const res1 = await POST(makeRequest({ email: 'nobody@test.com', password: 'pass' }))
    const body1 = await res1.json()

    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true })

    // Usuário existe mas senha errada
    vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as unknown as User)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
    const res2 = await POST(makeRequest({ email: 'admin@clinic.com', password: 'wrong' }))
    const body2 = await res2.json()

    expect(res1.status).toBe(401)
    expect(res2.status).toBe(401)
    expect(body1.error).toBe(body2.error) // mesma mensagem — impede user enumeration
  })
})

// ---------------------------------------------------------------------------
// Rate limiting (VULN-02 related)
// ---------------------------------------------------------------------------
describe('SECURITY: rate limiting', () => {
  it('retorna 429 quando limite de tentativas excedido', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfter: 300 })

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'pass' }))
    expect(res.status).toBe(429)
  })

  it('inclui header Retry-After no 429', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfter: 300 })

    const res = await POST(makeRequest({ email: 'a@b.com', password: 'pass' }))
    expect(res.headers.get('Retry-After')).toBe('300')
  })

  it('não consulta o banco de dados quando rate limit excedido', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfter: 60 })

    await POST(makeRequest({ email: 'a@b.com', password: 'pass' }))

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Email verification (VULN-03)
// ---------------------------------------------------------------------------
describe('SECURITY: email verification required', () => {
  it('retorna 403 com code EMAIL_NOT_VERIFIED para email não verificado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...MOCK_USER,
      emailVerified: null,
      role: 'ADMIN',
    } as unknown as User)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const res = await POST(makeRequest({ email: 'admin@clinic.com', password: 'correct' }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('OWNER pode logar sem email verificado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...MOCK_USER,
      emailVerified: null,
      role: 'OWNER',
    } as unknown as User)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const res = await POST(makeRequest({ email: 'owner@aura.com', password: 'correct' }))
    expect(res.status).toBe(200)
  })

  it('ADMIN com email verificado faz login normalmente', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as unknown as User)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const res = await POST(makeRequest({ email: 'admin@clinic.com', password: 'correct' }))
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// JWT payload integrity (VULN-04 / VULN-06)
// ---------------------------------------------------------------------------
describe('SECURITY: JWT payload', () => {
  it('JWT contém role, companyId e tokenVersion', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as unknown as User)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const res = await POST(makeRequest({ email: 'admin@clinic.com', password: 'correct' }))
    const body = await res.json()

    expect(body.token).toBeDefined()
    const decoded = jwt.verify(body.token, process.env.JWT_SECRET!) as Record<string, unknown>
    expect(decoded.role).toBe('ADMIN')
    expect(decoded.companyId).toBe('company-001')
    expect(decoded.tokenVersion).toBe(0)
  })

  it('JWT usa algoritmo HS256', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as unknown as User)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const res = await POST(makeRequest({ email: 'admin@clinic.com', password: 'correct' }))
    const body = await res.json()

    const header = JSON.parse(Buffer.from(body.token.split('.')[0], 'base64url').toString())
    expect(header.alg).toBe('HS256')
  })
})

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
describe('validação de input', () => {
  it('retorna 400 para email inválido', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', password: 'pass' }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 para senha vazia', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com', password: '' }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 para body sem campos', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Account status
// ---------------------------------------------------------------------------
describe('status da conta', () => {
  it('retorna 403 quando conta inativa', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...MOCK_USER,
      isActive: false,
    } as unknown as User)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const res = await POST(makeRequest({ email: 'admin@clinic.com', password: 'correct' }))
    expect(res.status).toBe(403)
  })

  it('retorna 503 quando sistema em manutenção', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as unknown as User)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue({
      maintenanceMode: true,
      maintenanceMessage: 'Retorne em breve',
    } as never)

    const res = await POST(makeRequest({ email: 'admin@clinic.com', password: 'correct' }))
    expect(res.status).toBe(503)
  })

  it('registra falha de login no audit log', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

    await POST(makeRequest({ email: 'nobody@test.com', password: 'pass' }))

    expect(logLoginFailure).toHaveBeenCalledOnce()
  })

  it('registra sucesso de login no audit log', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as unknown as User)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    await POST(makeRequest({ email: 'admin@clinic.com', password: 'correct' }))

    expect(logLogin).toHaveBeenCalledOnce()
  })
})
```

**Step 2: Rodar**

```bash
npx vitest run src/__tests__/security/login-security.test.ts
```
Expected: all tests PASS

**Step 3: Commit**

```bash
git add src/__tests__/security/login-security.test.ts
git commit -m "test(security): login security tests — timing attack, rate limit, JWT, email verification"
```

---

## Task 3: Testes de segurança — Webhook Asaas

**Files:**
- Create: `src/__tests__/security/webhook-asaas.test.ts`

**Step 1: Criar o arquivo**

```typescript
// src/__tests__/security/webhook-asaas.test.ts
// Testes de segurança para POST /api/webhooks/asaas

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Company } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    company: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))
vi.mock('@/lib/billingUtils', () => ({
  resolvePlanFromPayment: vi.fn().mockReturnValue('STARTER'),
}))

import { POST } from '../../app/api/webhooks/asaas/route'
import prisma from '@/lib/prisma'

const VALID_TOKEN = 'super-secret-webhook-token'

function makeWebhookRequest(token: string | null, body: Record<string, unknown> = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== null) headers['asaas-access-token'] = token
  return new NextRequest('http://localhost/api/webhooks/asaas', {
    method: 'POST',
    headers,
    body: JSON.stringify({ event: 'PAYMENT_CONFIRMED', ...body }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ASAAS_WEBHOOK_TOKEN = VALID_TOKEN
  vi.mocked(prisma.company.findFirst).mockResolvedValue(null)
  vi.mocked(prisma.company.update).mockResolvedValue({} as Company)
})

afterEach(() => {
  delete process.env.ASAAS_WEBHOOK_TOKEN
})

describe('SECURITY: autenticação do webhook Asaas (VULN-09)', () => {
  it('retorna 401 quando token ausente', async () => {
    const res = await POST(makeWebhookRequest(null))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando token incorreto', async () => {
    const res = await POST(makeWebhookRequest('wrong-token'))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando ASAAS_WEBHOOK_TOKEN não está configurado', async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN
    const res = await POST(makeWebhookRequest(VALID_TOKEN))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando token é string vazia', async () => {
    const res = await POST(makeWebhookRequest(''))
    expect(res.status).toBe(401)
  })

  it('processa evento com token correto', async () => {
    const res = await POST(makeWebhookRequest(VALID_TOKEN))
    expect(res.status).toBe(200)
  })

  it('não processa banco de dados quando token inválido', async () => {
    await POST(makeWebhookRequest('bad-token'))
    expect(prisma.company.findFirst).not.toHaveBeenCalled()
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('retorna 400 para JSON inválido mesmo com token correto', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/asaas', {
      method: 'POST',
      headers: {
        'asaas-access-token': VALID_TOKEN,
        'content-type': 'application/json',
      },
      body: 'not-valid-json{{{',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

**Step 2: Rodar**

```bash
npx vitest run src/__tests__/security/webhook-asaas.test.ts
```
Expected: all tests PASS

**Step 3: Commit**

```bash
git add src/__tests__/security/webhook-asaas.test.ts
git commit -m "test(security): Asaas webhook token validation tests (VULN-09)"
```

---

## Task 4: Testes de validação — Schema da rota de fotos

**Files:**
- Create: `src/__tests__/api/photos.test.ts`

**Step 1: Criar o arquivo**

```typescript
// src/__tests__/api/photos.test.ts
// Testes para GET/POST/DELETE /api/photos — validação Zod + autorização

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { PhotoRecord, Patient } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    photoRecord: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))
vi.mock('@/lib/apiGuards', () => ({
  checkWriteAccess: vi.fn().mockResolvedValue(null),
}))

import { GET, POST, DELETE } from '../../app/api/photos/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const MOCK_USER = { id: 'u1', email: 'a@b.com', role: 'ADMIN', companyId: 'c1', name: 'Admin' }

const MOCK_PHOTO = {
  id: 'photo-1',
  url: 'https://example.com/photo.jpg',
  type: 'BEFORE',
  procedure: 'Limpeza de pele',
  groupId: 'group_1',
  date: new Date(),
  companyId: 'c1',
  patientId: 'p1',
  createdAt: new Date(),
  patient: { id: 'p1', name: 'Paciente' },
}

function makeGETRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/photos')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString())
}

function makePOSTRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/photos', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function makeDELETERequest(id?: string) {
  const url = id
    ? `http://localhost/api/photos?id=${id}`
    : 'http://localhost/api/photos'
  return new NextRequest(url, { method: 'DELETE' })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as never)
})

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe('GET /api/photos', () => {
  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGETRequest())
    expect(res.status).toBe(401)
  })

  it('retorna lista de fotos', async () => {
    vi.mocked(prisma.photoRecord.findMany).mockResolvedValue([MOCK_PHOTO] as unknown as (PhotoRecord & { patient: Patient })[])
    const res = await GET(makeGETRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.photos).toHaveLength(1)
  })

  it('aplica filtro por patientId', async () => {
    vi.mocked(prisma.photoRecord.findMany).mockResolvedValue([])
    await GET(makeGETRequest({ patientId: 'p1' }))
    expect(prisma.photoRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ patientId: 'p1' }) })
    )
  })

  it('limita máximo de 100 registros mesmo que limit=9999 seja enviado', async () => {
    vi.mocked(prisma.photoRecord.findMany).mockResolvedValue([])
    await GET(makeGETRequest({ limit: '9999' }))
    expect(prisma.photoRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })
})

// ---------------------------------------------------------------------------
// POST — validação Zod (VULN-05)
// ---------------------------------------------------------------------------
describe('POST /api/photos — validação Zod', () => {
  const VALID_BODY = {
    patientId: 'clxxxxxxxxxxxxxxxxxxxxxxxx', // cuid válido
    url: 'https://storage.example.com/photo.jpg',
    type: 'BEFORE',
    procedure: 'Limpeza de pele',
  }

  it('retorna 201 com dados válidos', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord & { patient: Patient })
    const res = await POST(makePOSTRequest(VALID_BODY))
    expect(res.status).toBe(201)
  })

  it('SECURITY: rejeita URL que não é URL válida', async () => {
    const res = await POST(makePOSTRequest({ ...VALID_BODY, url: 'javascript:alert(1)' }))
    expect(res.status).toBe(400)
  })

  it('SECURITY: rejeita URL que não começa com http/https', async () => {
    const res = await POST(makePOSTRequest({ ...VALID_BODY, url: 'ftp://malicious.com/file' }))
    expect(res.status).toBe(400)
  })

  it('SECURITY: rejeita type fora do enum', async () => {
    const res = await POST(makePOSTRequest({ ...VALID_BODY, type: 'UNKNOWN' }))
    expect(res.status).toBe(400)
  })

  it('aceita type BEFORE', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord & { patient: Patient })
    const res = await POST(makePOSTRequest({ ...VALID_BODY, type: 'BEFORE' }))
    expect(res.status).toBe(201)
  })

  it('aceita type AFTER', async () => {
    vi.mocked(prisma.photoRecord.create).mockResolvedValue({ ...MOCK_PHOTO, type: 'AFTER' } as unknown as PhotoRecord & { patient: Patient })
    const res = await POST(makePOSTRequest({ ...VALID_BODY, type: 'AFTER' }))
    expect(res.status).toBe(201)
  })

  it('retorna 400 quando url está ausente', async () => {
    const { url: _, ...withoutUrl } = VALID_BODY
    const res = await POST(makePOSTRequest(withoutUrl))
    expect(res.status).toBe(400)
  })

  it('retorna 400 quando procedure está ausente', async () => {
    const { procedure: _, ...withoutProcedure } = VALID_BODY
    const res = await POST(makePOSTRequest(withoutProcedure))
    expect(res.status).toBe(400)
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePOSTRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe('DELETE /api/photos', () => {
  it('retorna 400 sem id', async () => {
    const res = await DELETE(makeDELETERequest())
    expect(res.status).toBe(400)
  })

  it('deleta somente fotos da própria empresa (tenant isolation)', async () => {
    vi.mocked(prisma.photoRecord.delete).mockResolvedValue(MOCK_PHOTO as unknown as PhotoRecord)
    await DELETE(makeDELETERequest('photo-1'))
    expect(prisma.photoRecord.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'photo-1', companyId: 'c1' } })
    )
  })

  it('retorna 401 sem autenticação', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await DELETE(makeDELETERequest('photo-1'))
    expect(res.status).toBe(401)
  })
})
```

**Step 2: Rodar**

```bash
npx vitest run src/__tests__/api/photos.test.ts
```
Expected: all tests PASS

**Step 3: Commit**

```bash
git add src/__tests__/api/photos.test.ts
git commit -m "test(api): photos endpoint validation tests — Zod schema, URL injection prevention (VULN-05)"
```

---

## Task 5: Testes de lib — apiGuards

**Files:**
- Create: `src/__tests__/lib/apiGuards.test.ts`

**Step 1: Criar o arquivo**

```typescript
// src/__tests__/lib/apiGuards.test.ts
// Testes para checkWriteAccess, checkModuleAccess, checkPatientLimit, checkProfessionalLimit

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    company: { findUnique: vi.fn() },
    patient: { count: vi.fn() },
    user: { count: vi.fn() },
  },
}))
vi.mock('../../lib/planPermissions', () => ({
  hasModuleAccess: vi.fn(),
  isReadOnlyMode: vi.fn(),
  canCreatePatient: vi.fn(),
  canCreateProfessional: vi.fn(),
  getPlanErrorMessage: vi.fn().mockResolvedValue('Upgrade necessário'),
}))

import {
  checkWriteAccess,
  checkModuleAccess,
  checkPatientLimit,
  checkProfessionalLimit,
} from '../../lib/apiGuards'
import prisma from '../../lib/prisma'
import {
  hasModuleAccess,
  isReadOnlyMode,
  canCreatePatient,
  canCreateProfessional,
} from '../../lib/planPermissions'

const ACTIVE_COMPANY = {
  plan: 'STARTER',
  subscriptionStatus: 'ACTIVE',
  subscriptionExpiresAt: new Date('2027-01-01'),
}

const USER = { id: 'u1', companyId: 'c1', role: 'ADMIN' }
const USER_NO_COMPANY = { id: 'u1', companyId: null, role: 'ADMIN' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.company.findUnique).mockResolvedValue(ACTIVE_COMPANY as never)
})

// ---------------------------------------------------------------------------
// checkWriteAccess
// ---------------------------------------------------------------------------
describe('checkWriteAccess', () => {
  it('retorna null quando empresa pode escrever', async () => {
    vi.mocked(isReadOnlyMode).mockReturnValue(false)
    const result = await checkWriteAccess(USER)
    expect(result).toBeNull()
  })

  it('retorna 403 quando empresa está em modo somente leitura', async () => {
    vi.mocked(isReadOnlyMode).mockReturnValue(true)
    const res = await checkWriteAccess(USER)
    expect(res).not.toBeNull()
    const body = await res!.json()
    expect(res!.status).toBe(403)
    expect(body.code).toBe('READ_ONLY_MODE')
  })

  it('retorna 403 quando usuário não tem companyId', async () => {
    const res = await checkWriteAccess(USER_NO_COMPANY)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  it('retorna 404 quando empresa não existe no banco', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
    const res = await checkWriteAccess(USER)
    expect(res!.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// checkModuleAccess
// ---------------------------------------------------------------------------
describe('checkModuleAccess', () => {
  it('retorna null quando módulo está disponível no plano', async () => {
    vi.mocked(hasModuleAccess).mockResolvedValue(true)
    const result = await checkModuleAccess(USER, 'financial' as never)
    expect(result).toBeNull()
  })

  it('retorna 403 com code MODULE_NOT_AVAILABLE quando módulo não disponível', async () => {
    vi.mocked(hasModuleAccess).mockResolvedValue(false)
    const res = await checkModuleAccess(USER, 'ai_features' as never)
    expect(res).not.toBeNull()
    const body = await res!.json()
    expect(res!.status).toBe(403)
    expect(body.code).toBe('MODULE_NOT_AVAILABLE')
  })

  it('retorna 403 quando usuário não tem companyId', async () => {
    const res = await checkModuleAccess(USER_NO_COMPANY, 'financial' as never)
    expect(res!.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// checkPatientLimit
// ---------------------------------------------------------------------------
describe('checkPatientLimit', () => {
  it('retorna null quando abaixo do limite de pacientes', async () => {
    vi.mocked(prisma.patient.count).mockResolvedValue(5)
    vi.mocked(canCreatePatient).mockResolvedValue(true)
    const result = await checkPatientLimit(USER)
    expect(result).toBeNull()
  })

  it('retorna 403 com code PATIENT_LIMIT_REACHED quando limite atingido', async () => {
    vi.mocked(prisma.patient.count).mockResolvedValue(50)
    vi.mocked(canCreatePatient).mockResolvedValue(false)
    const res = await checkPatientLimit(USER)
    expect(res).not.toBeNull()
    const body = await res!.json()
    expect(res!.status).toBe(403)
    expect(body.code).toBe('PATIENT_LIMIT_REACHED')
    expect(body.currentCount).toBe(50)
  })

  it('retorna 403 quando usuário não tem companyId', async () => {
    const res = await checkPatientLimit(USER_NO_COMPANY)
    expect(res!.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// checkProfessionalLimit
// ---------------------------------------------------------------------------
describe('checkProfessionalLimit', () => {
  it('retorna null quando abaixo do limite de profissionais', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(2)
    vi.mocked(canCreateProfessional).mockResolvedValue(true)
    const result = await checkProfessionalLimit(USER)
    expect(result).toBeNull()
  })

  it('retorna 403 com code PROFESSIONAL_LIMIT_REACHED quando limite atingido', async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(10)
    vi.mocked(canCreateProfessional).mockResolvedValue(false)
    const res = await checkProfessionalLimit(USER)
    expect(res).not.toBeNull()
    const body = await res!.json()
    expect(res!.status).toBe(403)
    expect(body.code).toBe('PROFESSIONAL_LIMIT_REACHED')
  })
})
```

**Step 2: Rodar**

```bash
npx vitest run src/__tests__/lib/apiGuards.test.ts
```
Expected: all tests PASS

**Step 3: Commit**

```bash
git add src/__tests__/lib/apiGuards.test.ts
git commit -m "test(lib): apiGuards unit tests — checkWriteAccess, checkModuleAccess, checkPatientLimit"
```

---

## Task 6: Testes de API — Register

**Files:**
- Create: `src/__tests__/api/auth-register.test.ts`

**Step 1: Criar o arquivo**

```typescript
// src/__tests__/api/auth-register.test.ts
// Testes para POST /api/auth/register

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { User, Company } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    company: { findUnique: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/rateLimiter', () => ({
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}))
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  TERMS_VERSION: '1.0',
}))
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2b$12$hashed') },
}))
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/utils', () => ({
  slugify: vi.fn().mockImplementation((s: string) => s.toLowerCase().replace(/\s+/g, '-')),
}))

import { POST } from '../../app/api/auth/register/route'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimiter'
import { sendVerificationEmail } from '@/lib/email'

const VALID_BODY = {
  name: 'João Silva',
  email: 'joao@clinica.com',
  password: 'senhaForte123',
  companyName: 'Clínica Beleza',
  state: 'SP',
}

const MOCK_COMPANY = { id: 'c1', name: 'Clínica Beleza', slug: 'clinica-beleza' }
const MOCK_USER = { id: 'u1', email: 'joao@clinica.com', name: 'João Silva', role: 'ADMIN', createdAt: new Date() }

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'origin': 'http://localhost:3000' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true })
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null) // email disponível
  vi.mocked(prisma.company.findUnique).mockResolvedValue(null) // slug disponível
  vi.mocked(prisma.company.create).mockResolvedValue(MOCK_COMPANY as unknown as Company)
  vi.mocked(prisma.user.create).mockResolvedValue(MOCK_USER as unknown as User)
})

describe('POST /api/auth/register', () => {
  it('cria usuário e empresa com sucesso, retorna 201', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.user.email).toBe(VALID_BODY.email)
  })

  it('cria empresa quando companyName é fornecido', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(prisma.company.create).toHaveBeenCalledOnce()
  })

  it('não cria empresa quando companyName é omitido', async () => {
    const { companyName: _, ...withoutCompany } = VALID_BODY
    await POST(makeRequest(withoutCompany))
    expect(prisma.company.create).not.toHaveBeenCalled()
  })

  it('retorna 409 quando email já está cadastrado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as unknown as User)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
  })

  it('retorna 429 quando rate limit excedido', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfter: 900 })
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(429)
  })

  it('SECURITY: retorna 400 para senha com menos de 8 caracteres', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, password: 'curta' }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 para email inválido', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, email: 'not-email' }))
    expect(res.status).toBe(400)
  })

  it('retorna 400 para nome curto (< 2 chars)', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, name: 'A' }))
    expect(res.status).toBe(400)
  })

  it('envia email de verificação após criar usuário', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(sendVerificationEmail).toHaveBeenCalledOnce()
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      VALID_BODY.email,
      VALID_BODY.name,
      expect.any(String) // token de verificação
    )
  })

  it('resolve conflito de slug com sufixo de estado', async () => {
    // Primeiro findUnique retorna empresa existente (slug base ocupado)
    // Segundo retorna null (slug com estado disponível)
    vi.mocked(prisma.company.findUnique)
      .mockResolvedValueOnce(MOCK_COMPANY as unknown as Company) // slug base ocupado
      .mockResolvedValueOnce(null) // slug-SP disponível
    await POST(makeRequest(VALID_BODY))
    const createCall = vi.mocked(prisma.company.create).mock.calls[0][0]
    expect((createCall.data as { slug: string }).slug).toContain('-SP')
  })

  it('não retorna senha no corpo da resposta', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    const userStr = JSON.stringify(body.user)
    expect(userStr).not.toContain('password')
    expect(userStr).not.toContain('hashed')
  })
})
```

**Step 2: Rodar**

```bash
npx vitest run src/__tests__/api/auth-register.test.ts
```
Expected: all tests PASS

**Step 3: Commit**

```bash
git add src/__tests__/api/auth-register.test.ts
git commit -m "test(api): register flow tests — rate limit, password length, email verification, slug conflict"
```

---

## Task 7: Commit final + verificação de cobertura

**Step 1: Rodar todos os testes**

```bash
npm run test:ci
```
Expected: TODOS passando (563+ testes)

**Step 2: Verificar cobertura das libs**

```bash
npm run test:coverage
```

**Step 3: Commit final**

```bash
git add -A
git commit -m "test: complete security test suite — 15 vulnerabilities covered, apiGuards, register flow"
```
