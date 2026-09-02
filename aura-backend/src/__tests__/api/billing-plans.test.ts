// aura-backend/src/__tests__/api/billing-plans.test.ts
// Testes para GET /api/billing/plans

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { saasPlan: { findMany: vi.fn() }, company: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/billing/plans/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeRequest() {
  return new NextRequest('http://localhost/api/billing/plans')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.saasPlan.findMany).mockResolvedValue([])
})

describe('GET /api/billing/plans', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('lista apenas planos ativos ordenados por preço', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    await GET(makeRequest())
    expect(prisma.saasPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, orderBy: { price: 'asc' } })
    )
  })

  it('retorna o plano e status atuais da empresa do usuário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ plan: 'PRO', subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: new Date('2026-12-31') } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data.currentPlan).toBe('PRO')
    expect(body.data.currentStatus).toBe('ACTIVE')
  })

  it('retorna null para o plano atual quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data.currentPlan).toBeNull()
    expect(prisma.company.findUnique).not.toHaveBeenCalled()
  })

  it('retorna null para o plano atual quando a empresa não é encontrada', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data.currentPlan).toBeNull()
  })
})
