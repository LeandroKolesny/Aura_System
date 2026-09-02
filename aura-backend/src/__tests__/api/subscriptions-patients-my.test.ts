// aura-backend/src/__tests__/api/subscriptions-patients-my.test.ts
// Testes para GET /api/subscriptions/patients/my

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patient: { findFirst: vi.fn() },
    patientSubscription: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/subscriptions/patients/my/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const PATIENT_USER = { id: 'u1', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }

function makeRequest() {
  return new NextRequest('http://localhost/api/subscriptions/patients/my')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/subscriptions/patients/my', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna lista vazia quando usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...PATIENT_USER, companyId: null } as never)
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
  })

  it('retorna lista vazia quando não há registro de paciente correspondente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('busca apenas assinaturas PENDING, ACTIVE ou PAUSED', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([])

    await GET(makeRequest())

    expect(prisma.patientSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['PENDING', 'ACTIVE', 'PAUSED'] } }),
      })
    )
  })

  it('calcula sessões usadas e restantes corretamente por procedimento', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([{
      id: 'sub1', status: 'ACTIVE', startDate: new Date(), nextBillingDate: new Date(), lastCycleReset: new Date(),
      sessionsUsedThisCycle: { proc1: 2 },
      plan: {
        id: 'plan1', name: 'Plano Mensal', price: 150, description: 'desc', imageUrl: null,
        items: [
          { procedureId: 'proc1', sessionsPerCycle: 4, procedure: { id: 'proc1', name: 'Limpeza', durationMinutes: 60 } },
        ],
      },
    }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data[0].items[0]).toEqual({
      procedureId: 'proc1', procedureName: 'Limpeza', sessionsPerCycle: 4, sessionsUsed: 2, sessionsRemaining: 2,
    })
  })

  it('nunca retorna sessionsRemaining negativo mesmo se sessionsUsed exceder o limite do ciclo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([{
      id: 'sub1', status: 'ACTIVE', startDate: new Date(), nextBillingDate: new Date(), lastCycleReset: new Date(),
      sessionsUsedThisCycle: { proc1: 10 },
      plan: {
        id: 'plan1', name: 'Plano Mensal', price: 150, description: null, imageUrl: null,
        items: [
          { procedureId: 'proc1', sessionsPerCycle: 4, procedure: { id: 'proc1', name: 'Limpeza', durationMinutes: 60 } },
        ],
      },
    }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data[0].items[0].sessionsRemaining).toBe(0)
  })

  it('trata sessionsUsedThisCycle nulo como zero para todos os procedimentos', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([{
      id: 'sub1', status: 'ACTIVE', startDate: new Date(), nextBillingDate: new Date(), lastCycleReset: new Date(),
      sessionsUsedThisCycle: null,
      plan: {
        id: 'plan1', name: 'Plano Mensal', price: 150, description: null, imageUrl: null,
        items: [
          { procedureId: 'proc1', sessionsPerCycle: 4, procedure: { id: 'proc1', name: 'Limpeza', durationMinutes: 60 } },
        ],
      },
    }] as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.data[0].items[0].sessionsUsed).toBe(0)
    expect(body.data[0].items[0].sessionsRemaining).toBe(4)
  })
})
