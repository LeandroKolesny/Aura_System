// aura-backend/src/__tests__/api/subscriptions-patients.test.ts
// Testes para GET/POST /api/subscriptions/patients (assinantes do clube)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patientSubscription: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    patient: { findFirst: vi.fn() },
    subscriptionPlan: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/apiGuards', () => ({ checkWriteAccess: vi.fn() }))

import { GET, POST } from '../../app/api/subscriptions/patients/route'
import { getAuthUser } from '@/lib/auth'
import { checkWriteAccess } from '@/lib/apiGuards'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

const PLAN = { id: 'plan1', companyId: 'c1', isActive: true, items: [{ procedureId: 'proc1' }] }

function makeGetRequest(qs = '') {
  return new NextRequest(`http://localhost/api/subscriptions/patients${qs}`)
}
function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/subscriptions/patients', {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

const VALID_BODY = { patientId: 'p1', planId: 'plan1', nextBillingDate: '2026-02-01' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkWriteAccess).mockResolvedValue(null)
  vi.mocked(prisma.$transaction).mockImplementation((cb: unknown) => (cb as (tx: unknown) => Promise<unknown>)(prisma))
})

describe('GET /api/subscriptions/patients', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(403)
  })

  it('lista assinantes escopados à empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([])

    await GET(makeGetRequest())

    expect(prisma.patientSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1' } })
    )
  })

  it('filtra por status e patientId quando informados', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([])

    await GET(makeGetRequest('?status=ACTIVE&patientId=p1'))

    expect(prisma.patientSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', status: 'ACTIVE', patientId: 'p1' } })
    )
  })

  // Caso exercido por `subscriptionsApi.listPending()` no banner "Novos Planos
  // para Aprovação" do Dashboard: GET /api/subscriptions/patients?status=PENDING
  it('filtra por status=PENDING (usado pelo banner de planos pendentes do Dashboard)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findMany).mockResolvedValue([])

    const res = await GET(makeGetRequest('?status=PENDING'))

    expect(res.status).toBe(200)
    expect(prisma.patientSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', status: 'PENDING' } })
    )
  })
})

describe('POST /api/subscriptions/patients', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makePostRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('bloqueia quando o plano do sistema não permite escrita', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const { NextResponse } = await import('next/server')
    vi.mocked(checkWriteAccess).mockResolvedValue(NextResponse.json({ error: 'bloqueado' }, { status: 402 }))

    const res = await POST(makePostRequest(VALID_BODY))
    expect(res.status).toBe(402)
  })

  it('retorna 400 quando faltam campos obrigatórios', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makePostRequest({ patientId: 'p1' }))
    expect(res.status).toBe(400)
  })

  it('retorna 404 quando o paciente não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(PLAN as never)

    const res = await POST(makePostRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('retorna 404 quando o plano não existe ou está inativo', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(null)

    const res = await POST(makePostRequest(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it('retorna 409 quando o paciente já possui assinatura ativa (checagem atômica na transação)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(PLAN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({ id: 'sub-existing' } as never)

    const res = await POST(makePostRequest(VALID_BODY))
    expect(res.status).toBe(409)
    expect(prisma.patientSubscription.create).not.toHaveBeenCalled()
  })

  it('cria a assinatura com sessões zeradas para cada procedimento do plano', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(PLAN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.patientSubscription.create).mockResolvedValue({ id: 'sub-new' } as never)

    const res = await POST(makePostRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.success).toBe(true)
    expect(prisma.patientSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ patientId: 'p1', planId: 'plan1', sessionsUsedThisCycle: { proc1: 0 } }) })
    )
  })
})
