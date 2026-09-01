// src/__tests__/security/login-security.test.ts
// Testes de segurança para o endpoint POST /api/auth/login

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import type { User } from '@prisma/client'

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
  default: { compare: vi.fn() },
}))

import { POST } from '../../app/api/auth/login/route'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimiter'
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
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 })
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
    expect(hashArg).toMatch(/^\$2b\$/)
  })

  it('retorna mesma mensagem de erro para usuário inexistente e senha incorreta', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
    const res1 = await POST(makeRequest({ email: 'nobody@test.com', password: 'pass' }))
    const body1 = await res1.json()

    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 })
    vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue(null)

    vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as unknown as User)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
    const res2 = await POST(makeRequest({ email: 'admin@clinic.com', password: 'wrong' }))
    const body2 = await res2.json()

    expect(res1.status).toBe(401)
    expect(res2.status).toBe(401)
    expect(body1.error).toBe(body2.error)
  })
})

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
describe('SECURITY: rate limiting', () => {
  it('retorna 429 quando limite de tentativas excedido', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 300 })
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'pass' }))
    expect(res.status).toBe(429)
  })

  it('inclui header Retry-After no 429', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 300 })
    const res = await POST(makeRequest({ email: 'a@b.com', password: 'pass' }))
    expect(res.headers.get('Retry-After')).toBe('300')
  })

  it('não consulta o banco quando rate limit excedido', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 60 })
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

    const header = JSON.parse(
      Buffer.from(body.token.split('.')[0], 'base64url').toString()
    ) as { alg: string }
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
