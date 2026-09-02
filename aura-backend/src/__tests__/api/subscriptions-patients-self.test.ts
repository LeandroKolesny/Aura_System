// aura-backend/src/__tests__/api/subscriptions-patients-self.test.ts
// Testes para POST /api/subscriptions/patients/self

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    subscriptionPlan: { findFirst: vi.fn() },
    patient: { findFirst: vi.fn() },
    patientSubscription: { findFirst: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { POST } from '../../app/api/subscriptions/patients/self/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const PATIENT_USER = { id: 'u1', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }
const ADMIN = { id: 'u2', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }

const PLAN = {
  id: 'plan1', companyId: 'c1', isActive: true,
  items: [{ procedureId: 'proc1' }, { procedureId: 'proc2' }],
}

function makeRequest(body: Record<string, unknown> = { planId: 'plan1' }) {
  return new NextRequest('http://localhost/api/subscriptions/patients/self', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/subscriptions/patients/self', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não é PATIENT', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('retorna 403 quando o paciente não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...PATIENT_USER, companyId: null } as never)
    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('retorna 400 quando planId não é enviado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('retorna 404 quando o plano não existe, está inativo ou é de outra empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(404)
    expect(prisma.subscriptionPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'plan1', companyId: 'c1', isActive: true } })
    )
  })

  it('retorna 404 quando não existe registro de paciente para este usuário', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(PLAN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)
    const res = await POST(makeRequest())
    expect(res.status).toBe(404)
  })

  it('retorna a assinatura existente (200) sem duplicar se já houver uma PENDING/ACTIVE/PAUSED pro mesmo plano', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(PLAN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue({ id: 'sub-existing', status: 'ACTIVE', planId: 'plan1' } as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe('sub-existing')
    expect(prisma.patientSubscription.create).not.toHaveBeenCalled()
  })

  it('cria uma nova assinatura PENDING (201) com sessões zeradas para cada item do plano', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.subscriptionPlan.findFirst).mockResolvedValue(PLAN as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.patientSubscription.create).mockResolvedValue({ id: 'sub-new', status: 'PENDING', planId: 'plan1' } as never)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ id: 'sub-new', status: 'PENDING', planId: 'plan1' })
    expect(prisma.patientSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: 'p1', planId: 'plan1', companyId: 'c1', status: 'PENDING',
          sessionsUsedThisCycle: { proc1: 0, proc2: 0 },
        }),
      })
    )
  })
})
