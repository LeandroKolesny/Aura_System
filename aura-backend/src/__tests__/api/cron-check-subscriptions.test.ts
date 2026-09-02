// aura-backend/src/__tests__/api/cron-check-subscriptions.test.ts
// Testes para GET /api/cron/check-subscriptions

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { company: { findMany: vi.fn(), update: vi.fn() } },
}))

import { GET } from '../../app/api/cron/check-subscriptions/route'
import prisma from '@/lib/prisma'

function makeReq(token = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/check-subscriptions', {
    headers: { authorization: `Bearer ${token}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
  vi.mocked(prisma.company.findMany).mockResolvedValue([])
})

describe('GET /api/cron/check-subscriptions', () => {
  it('retorna 401 sem Authorization header', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/check-subscriptions'))
    expect(res.status).toBe(401)
  })

  it('retorna 401 com token errado', async () => {
    const res = await GET(makeReq('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('retorna 401 quando CRON_SECRET não está definido', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeReq('any-token'))
    expect(res.status).toBe(401)
  })

  it('busca apenas empresas com assinatura expirada, não canceladas e ainda não movidas para BASIC', async () => {
    await GET(makeReq())
    expect(prisma.company.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subscriptionExpiresAt: { lt: expect.any(Date) },
          plan: { not: 'BASIC' },
          subscriptionStatus: { notIn: ['CANCELED'] },
        }),
      })
    )
  })

  it('retorna processed=0 quando não há empresas expiradas', async () => {
    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.processed).toBe(0)
    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('move a empresa expirada para BASIC/OVERDUE preservando o plano anterior em lastPlan', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'c1', name: 'Clínica Teste', plan: 'PRO', subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: new Date('2026-01-01') },
    ] as never)
    vi.mocked(prisma.company.update).mockResolvedValue({} as never)

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { lastPlan: 'PRO', plan: 'BASIC', subscriptionStatus: 'OVERDUE' },
    })
  })

  it('conta erro por empresa individualmente sem interromper o processamento das demais', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([
      { id: 'c1', name: 'Falha', plan: 'PRO', subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: new Date() },
      { id: 'c2', name: 'Sucesso', plan: 'STARTER', subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: new Date() },
    ] as never)
    vi.mocked(prisma.company.update)
      .mockRejectedValueOnce(new Error('db error'))
      .mockResolvedValueOnce({} as never)

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(body.errors).toBe(1)
  })

  it('retorna 500 em caso de erro inesperado na consulta principal', async () => {
    vi.mocked(prisma.company.findMany).mockRejectedValue(new Error('db down'))
    const res = await GET(makeReq())
    expect(res.status).toBe(500)
  })
})
