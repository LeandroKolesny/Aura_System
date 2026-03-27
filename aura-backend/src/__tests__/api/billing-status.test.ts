// aura-backend/src/__tests__/api/billing-status.test.ts
// Testes para GET /api/billing/status

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mocks devem vir antes dos imports do módulo testado
vi.mock('@/lib/prisma', () => ({
  default: {
    company: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
}))

import { GET } from '../../app/api/billing/status/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

function makeRequest() {
  return new NextRequest('http://localhost/api/billing/status', {
    headers: { Authorization: 'Bearer token' },
  })
}

const MOCK_USER = { id: 'user-1', email: 'admin@aura.com', role: 'ADMIN', companyId: 'company-1' }

const MOCK_COMPANY = {
  plan: 'STARTER',
  subscriptionStatus: 'ACTIVE',
  subscriptionExpiresAt: new Date('2026-04-08'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/billing/status', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBeDefined()
  })

  it('retorna 400 quando usuário não tem companyId', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...MOCK_USER, companyId: null } as any)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('retorna status, plan e expiresAt da empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as any)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(MOCK_COMPANY as any)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('ACTIVE')
    expect(body.data.plan).toBe('STARTER')
    expect(body.data.expiresAt).toBeDefined()
  })

  it('busca a empresa pelo companyId do JWT', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as any)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(MOCK_COMPANY as any)

    await GET(makeRequest())

    expect(prisma.company.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'company-1' } })
    )
  })

  it('retorna 404 quando empresa não existe no banco', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(MOCK_USER as any)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBeDefined()
  })
})
