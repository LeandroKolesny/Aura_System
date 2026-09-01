// src/__tests__/api/auth-login.test.ts
// Testes para POST /api/auth/login

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { User, Patient, SystemSettings } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn() },
    patient: { findFirst: vi.fn() },
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
vi.mock('@/lib/auth', () => ({
  generateJWT: vi.fn().mockReturnValue('mock-jwt-token'),
}))
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}))

import { POST } from '../../app/api/auth/login/route'
import prisma from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimiter'
import { logLogin, logLoginFailure } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'

// ── fixtures ──────────────────────────────────────────────────────────────────

const MOCK_COMPANY = {
  id: 'company-001',
  name: 'Clínica Test',
  slug: 'clinica-test',
  plan: 'BASIC',
  subscriptionStatus: 'ACTIVE',
  subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  businessHours: {},
  onboardingCompleted: true,
}

const MOCK_USER = {
  id: 'user-001',
  email: 'admin@clinica.com',
  name: 'Admin Test',
  password: '$2b$12$hashed',
  avatar: null,
  role: 'ADMIN',
  isActive: true,
  tokenVersion: 0,
  emailVerified: new Date('2024-01-01'),
  company: MOCK_COMPANY,
} as unknown as User & { company: typeof MOCK_COMPANY }

const VALID_BODY = { email: 'admin@clinica.com', password: 'senhaCorreta123' }

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
  vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as unknown as User)
  vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
  vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
})

// ── testes ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {

  it('retorna 200 com token e dados do usuário em login válido', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.token).toBe('mock-jwt-token')
    expect(body.user.email).toBe(MOCK_USER.email)
    expect(body.user.password).toBeUndefined()
  })

  it('seta cookie de sessão no login bem-sucedido', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    const cookie = res.headers.get('set-cookie')
    expect(cookie).toContain('aura_session')
    expect(cookie).toContain('HttpOnly')
  })

  it('registra auditoria de login bem-sucedido', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(logLogin).toHaveBeenCalledOnce()
    expect(logLoginFailure).not.toHaveBeenCalled()
  })

  it('SECURITY: executa bcrypt.compare mesmo quando usuário não existe (timing-safe)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    await POST(makeRequest(VALID_BODY))
    expect(bcrypt.compare).toHaveBeenCalledOnce()
  })

  it('retorna 401 quando usuário não encontrado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
    expect(logLoginFailure).toHaveBeenCalledOnce()
  })

  it('retorna 401 quando senha incorreta', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toContain('incorretos')
    expect(logLoginFailure).toHaveBeenCalledOnce()
  })

  it('retorna 403 quando conta está desativada', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...MOCK_USER, isActive: false } as unknown as User)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(403)
    expect(logLoginFailure).toHaveBeenCalledOnce()
  })

  it('retorna 403 com code EMAIL_NOT_VERIFIED quando email não verificado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...MOCK_USER, emailVerified: null } as unknown as User)
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('OWNER pode logar sem verificar email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...MOCK_USER,
      role: 'OWNER',
      emailVerified: null,
    } as unknown as User)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
  })

  it('retorna 503 quando sistema em manutenção (non-OWNER)', async () => {
    vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue({
      id: 'global',
      maintenanceMode: true,
      maintenanceMessage: 'Em manutenção.',
    } as unknown as SystemSettings)
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.maintenance).toBe(true)
  })

  it('OWNER ignora modo de manutenção', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...MOCK_USER, role: 'OWNER' } as unknown as User)
    vi.mocked(prisma.systemSettings.findUnique).mockResolvedValue({
      id: 'global',
      maintenanceMode: true,
    } as unknown as SystemSettings)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(200)
  })

  it('retorna 429 quando rate limit excedido', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 900 })
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(429)
  })

  it('retorna 400 para body inválido', async () => {
    const res = await POST(makeRequest({ email: 'nao-e-email', password: '' }))
    expect(res.status).toBe(400)
  })

  it('inclui patientId no retorno para role PATIENT', async () => {
    const PATIENT_ID = 'patient-001'
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...MOCK_USER, role: 'PATIENT' } as unknown as User)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: PATIENT_ID } as Patient)
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.user.patientId).toBe(PATIENT_ID)
  })

  it('não expõe senha no retorno', async () => {
    const res = await POST(makeRequest(VALID_BODY))
    const body = await res.json()
    expect(JSON.stringify(body.user)).not.toContain('password')
    expect(JSON.stringify(body.user)).not.toContain('hashed')
  })
})
