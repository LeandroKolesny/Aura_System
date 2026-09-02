// aura-backend/src/__tests__/api/subscriptions-patients-history.test.ts
// Testes para GET /api/subscriptions/patients/[id]/history

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  default: {
    patientSubscription: { findFirst: vi.fn() },
    patient: { findFirst: vi.fn() },
    appointment: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))

import { GET } from '../../app/api/subscriptions/patients/[id]/history/route'
import { getAuthUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

const ADMIN = { id: 'u1', email: 'admin@clinica.com', role: 'ADMIN', companyId: 'c1' }
const PATIENT_USER = { id: 'u2', email: 'paciente@email.com', role: 'PATIENT', companyId: 'c1' }

const SUBSCRIPTION = {
  id: 'sub1', patientId: 'p1', companyId: 'c1',
  patient: { id: 'p1', email: 'paciente@email.com' }, plan: { name: 'Plano Mensal' },
}

function makeRequest() {
  return new NextRequest('http://localhost/api/subscriptions/patients/sub1/history')
}
function makeParams() {
  return { params: Promise.resolve({ id: 'sub1' }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
})

describe('GET /api/subscriptions/patients/[id]/history', () => {
  it('retorna 401 quando não autenticado', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando usuário não tem empresa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ ...ADMIN, companyId: null } as never)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(403)
  })

  it('retorna 404 quando a assinatura não existe', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(null)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(404)
  })

  it('paciente recebe 403 ao tentar ver assinatura de outra pessoa', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(SUBSCRIPTION as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p2' } as never) // outro paciente

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(403)
  })

  it('paciente recebe 403 quando não tem registro de paciente correspondente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(SUBSCRIPTION as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null)

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(403)
  })

  it('paciente consegue ver a própria assinatura', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(PATIENT_USER as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(SUBSCRIPTION as never)
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'p1' } as never)

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
  })

  it('admin acessa qualquer assinatura da empresa sem checagem de dono', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(SUBSCRIPTION as never)

    const res = await GET(makeRequest(), makeParams())

    expect(res.status).toBe(200)
    expect(prisma.patient.findFirst).not.toHaveBeenCalled()
  })

  it('mapeia os agendamentos corretamente (nome do procedimento, profissional, sem fotos)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(SUBSCRIPTION as never)
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([
      {
        id: 'appt1', date: new Date('2026-01-10'), status: 'COMPLETED',
        procedure: { id: 'proc1', name: 'Limpeza de Pele' },
        professional: { id: 'prof1', name: 'Dra. Ana' },
      },
    ] as never)

    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()

    expect(body.data).toEqual([
      { id: 'appt1', date: '2026-01-10T00:00:00.000Z', status: 'COMPLETED', procedureName: 'Limpeza de Pele', professionalName: 'Dra. Ana', photos: [] },
    ])
  })

  it('busca agendamentos ordenados por data decrescente', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ADMIN as never)
    vi.mocked(prisma.patientSubscription.findFirst).mockResolvedValue(SUBSCRIPTION as never)

    await GET(makeRequest(), makeParams())

    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subscriptionId: 'sub1' }, orderBy: { date: 'desc' } })
    )
  })
})
