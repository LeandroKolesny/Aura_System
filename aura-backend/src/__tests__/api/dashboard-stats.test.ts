// aura-backend/src/__tests__/api/dashboard-stats.test.ts
// Testes para GET /api/dashboard/stats

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    lead: { count: vi.fn() },
    patient: { count: vi.fn() },
    appointment: { count: vi.fn() },
    transaction: { aggregate: vi.fn() },
    inventoryItem: { count: vi.fn() },
    activity: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/dashboard/stats/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

function makeRequest() {
  return new NextRequest('http://localhost/api/dashboard/stats')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.lead.count).mockResolvedValue(0)
  vi.mocked(prisma.patient.count).mockResolvedValue(0)
  vi.mocked(prisma.appointment.count).mockResolvedValue(0)
  vi.mocked(prisma.transaction.aggregate).mockResolvedValue({ _sum: { amount: 0 } } as never)
  vi.mocked(prisma.inventoryItem.count).mockResolvedValue(0)
  vi.mocked(prisma.activity.findMany).mockResolvedValue([])
})

describe('GET /api/dashboard/stats', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
  })

  it('calcula a taxa de conversão de leads corretamente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.count).mockResolvedValueOnce(20).mockResolvedValueOnce(5)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.stats.leads).toEqual({ total: 20, won: 5, conversionRate: '25.0%' })
  })

  it('retorna conversionRate 0% quando não há leads', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stats.leads.conversionRate).toBe('0%')
  })

  it('tolera falha na tabela de leads/atividades (fallback para 0/[])', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.lead.count).mockRejectedValue(new Error('tabela ausente'))
    vi.mocked(prisma.activity.findMany).mockRejectedValue(new Error('erro'))

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.stats.leads.total).toBe(0)
    expect(body.recentActivities).toEqual([])
  })

  it('calcula lucro e margem de lucro financeira', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.transaction.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 1000 } } as never)
      .mockResolvedValueOnce({ _sum: { amount: 400 } } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.stats.financial).toEqual({ income: 1000, expense: 400, profit: 600, profitMargin: '60.0%' })
  })

  it('retorna profitMargin 0% quando não há receita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.stats.financial.profitMargin).toBe('0%')
  })

  it('retorna 500 em caso de erro inesperado (fora dos fallbacks protegidos)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.count).mockRejectedValue(new Error('db down'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
