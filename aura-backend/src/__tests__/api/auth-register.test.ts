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
  TERMS_TEXT_HASH: 'sha256-mock-hash-abc123',
}))
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2b$12$hashed') },
}))
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/utils', () => ({
  slugify: vi.fn().mockImplementation((s: string) =>
    s.toLowerCase().replace(/\s+/g, '-')
  ),
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
const MOCK_USER = {
  id: 'u1',
  email: 'joao@clinica.com',
  name: 'João Silva',
  role: 'ADMIN',
  createdAt: new Date(),
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 })
  vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.company.findUnique).mockResolvedValue(null)
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
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 900 })
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

  it('retorna 400 para nome muito curto (< 2 chars)', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, name: 'A' }))
    expect(res.status).toBe(400)
  })

  it('envia email de verificação após criar usuário', async () => {
    await POST(makeRequest(VALID_BODY))
    expect(sendVerificationEmail).toHaveBeenCalledOnce()
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      VALID_BODY.email,
      VALID_BODY.name,
      expect.any(String)
    )
  })

  it('resolve conflito de slug com sufixo de estado', async () => {
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

  // ── LGPD ──────────────────────────────────────────────────────────────────

  it('LGPD: salva IP, user-agent e hash dos termos quando acceptedTerms=true', async () => {
    await POST(makeRequest({ ...VALID_BODY, acceptedTerms: true }))
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    const data = createCall.data as Record<string, unknown>
    expect(data.acceptedTermsAt).toBeInstanceOf(Date)
    expect(data.acceptedTermsVersion).toBe('1.0')
    expect(data.acceptedTermsHash).toBe('sha256-mock-hash-abc123')
    expect(data.acceptedTermsIp).toBeDefined()
    expect(data.acceptedTermsAgent).toBeDefined()
  })

  it('LGPD: não salva dados de termos quando acceptedTerms=false', async () => {
    await POST(makeRequest({ ...VALID_BODY, acceptedTerms: false }))
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    const data = createCall.data as Record<string, unknown>
    expect(data.acceptedTermsAt).toBeNull()
    expect(data.acceptedTermsVersion).toBeNull()
    expect(data.acceptedTermsHash).toBeNull()
  })

  it('LGPD: salva IP e data de consentimento de marketing quando marketingConsent=true', async () => {
    await POST(makeRequest({ ...VALID_BODY, marketingConsent: true }))
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    const data = createCall.data as Record<string, unknown>
    expect(data.marketingConsent).toBe(true)
    expect(data.marketingConsentAt).toBeInstanceOf(Date)
    expect(data.marketingConsentIp).toBeDefined()
  })

  it('LGPD: marketingConsent=false não salva data nem IP', async () => {
    await POST(makeRequest({ ...VALID_BODY, marketingConsent: false }))
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    const data = createCall.data as Record<string, unknown>
    expect(data.marketingConsent).toBe(false)
    expect(data.marketingConsentAt).toBeNull()
    expect(data.marketingConsentIp).toBeNull()
  })

  it('cria usuário com role ESTHETICIAN quando companyName não informado', async () => {
    const { companyName: _, ...withoutCompany } = VALID_BODY
    await POST(makeRequest(withoutCompany))
    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0]
    const data = createCall.data as Record<string, unknown>
    expect(data.role).toBe('ESTHETICIAN')
    expect(data.companyId).toBeUndefined()
  })
})
