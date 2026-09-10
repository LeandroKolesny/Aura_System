// aura-backend/src/__tests__/api/cron-reset-subscription-cycles.test.ts
// Testes para GET /api/cron/reset-subscription-cycles
// (renovação de ciclo das assinaturas do Clube de Assinaturas inscritas
//  manualmente — sem depender do webhook do Asaas)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: { patientSubscription: { findMany: vi.fn(), update: vi.fn() } },
}))

import { GET } from '../../app/api/cron/reset-subscription-cycles/route'
import prisma from '@/lib/prisma'

function makeReq(token = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/reset-subscription-cycles', {
    headers: { authorization: `Bearer ${token}` },
  })
}

function activeSub(over: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    status: 'ACTIVE',
    nextBillingDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // ontem
    lastCycleReset: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    sessionsUsedThisCycle: { 'proc-a': 4, 'proc-b': 2 },
    plan: { items: [{ procedureId: 'proc-a' }, { procedureId: 'proc-b' }] },
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
  vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([])
  vi.mocked(prisma.patientSubscription.update).mockResolvedValue({} as never)
})

describe('GET /api/cron/reset-subscription-cycles', () => {
  it('retorna 401 sem Authorization header', async () => {
    const res = await GET(new NextRequest('http://localhost/api/cron/reset-subscription-cycles'))
    expect(res.status).toBe(401)
    expect(prisma.patientSubscription.findMany).not.toHaveBeenCalled()
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

  it('busca apenas assinaturas ACTIVE com nextBillingDate vencida', async () => {
    await GET(makeReq())
    expect(prisma.patientSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          nextBillingDate: { lte: expect.any(Date) },
        }),
      })
    )
  })

  it('retorna processed=0 e não atualiza nada quando nenhuma assinatura se aplica', async () => {
    const res = await GET(makeReq())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.processed).toBe(0)
    expect(prisma.patientSubscription.update).not.toHaveBeenCalled()
  })

  it('zera sessionsUsedThisCycle de todos os itens, atualiza lastCycleReset e avança nextBillingDate +1 mês', async () => {
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([activeSub()] as never)

    const before = new Date()
    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.processed).toBe(1)

    const updateArg = vi.mocked(prisma.patientSubscription.update).mock.calls[0][0] as {
      where: { id: string }
      data: { sessionsUsedThisCycle: Record<string, number>; lastCycleReset: Date; nextBillingDate: Date }
    }
    expect(updateArg.where).toEqual({ id: 'sub-1' })
    expect(updateArg.data.sessionsUsedThisCycle).toEqual({ 'proc-a': 0, 'proc-b': 0 })
    expect(updateArg.data.lastCycleReset.getTime()).toBeGreaterThanOrEqual(before.getTime())

    const expectedNext = new Date(updateArg.data.lastCycleReset)
    expectedNext.setMonth(expectedNext.getMonth() + 1)
    expect(updateArg.data.nextBillingDate.getTime()).toBe(expectedNext.getTime())
  })

  it('não toca assinaturas ACTIVE cuja nextBillingDate ainda está no futuro (não vêm na query)', async () => {
    // o filtro é feito no banco (nextBillingDate: { lte: now }); simulamos isso
    // devolvendo lista vazia — a asserção é que nada é atualizado.
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([])
    const res = await GET(makeReq())
    const body = await res.json()
    expect(body.processed).toBe(0)
    expect(prisma.patientSubscription.update).not.toHaveBeenCalled()
  })

  it('não processa assinaturas CANCELED/PAUSED (filtro status: ACTIVE na query)', async () => {
    await GET(makeReq())
    const whereArg = vi.mocked(prisma.patientSubscription.findMany).mock.calls[0][0] as {
      where: { status: string }
    }
    expect(whereArg.where.status).toBe('ACTIVE')
  })

  it('conta erro por assinatura sem interromper as demais', async () => {
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([
      activeSub({ id: 'sub-1' }),
      activeSub({ id: 'sub-2' }),
    ] as never)
    vi.mocked(prisma.patientSubscription.update)
      .mockRejectedValueOnce(new Error('db error'))
      .mockResolvedValueOnce({} as never)

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body.processed).toBe(1)
    expect(body.errors).toBe(1)
  })

  it('retorna 500 quando a consulta principal falha', async () => {
    vi.mocked(prisma.patientSubscription.findMany).mockRejectedValue(new Error('db down'))
    const res = await GET(makeReq())
    expect(res.status).toBe(500)
  })
})
